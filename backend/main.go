package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"encoding/base64"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

const (
	BUFFER_SIZE     = 16 // Default ring buffer size
	MAX_FRAME_SIZE  = 5 * 1024 * 1024 // 5MB max frame size
	CLEANUP_INTERVAL = 30 * time.Second
	CLIENT_TIMEOUT   = 2 * time.Minute
)

// Frame represents a single webcam frame
type Frame struct {
	Data      []byte    `json:"data"`
	Timestamp time.Time `json:"timestamp"`
	Size      int       `json:"size"`
	Format    string    `json:"format"`
}

// RingBuffer represents a circular buffer for frames
type RingBuffer struct {
	frames     []*Frame
	head       int
	tail       int
	size       int
	capacity   int
	mutex      sync.RWMutex
	frameCount uint64
}

// NewRingBuffer creates a new ring buffer with specified capacity
func NewRingBuffer(capacity int) *RingBuffer {
	return &RingBuffer{
		frames:   make([]*Frame, capacity),
		capacity: capacity,
	}
}

// Add adds a frame to the ring buffer only if it's newer than the latest frame
func (rb *RingBuffer) Add(frame *Frame) bool {
	rb.mutex.Lock()
	defer rb.mutex.Unlock()

	// Check if this frame is newer than the latest frame
	if rb.size > 0 {
		lastIndex := rb.head - 1
		if lastIndex < 0 {
			lastIndex = rb.capacity - 1
		}
		latestFrame := rb.frames[lastIndex]
		
		// If the incoming frame is older than or equal to the latest frame, reject it
		if !frame.Timestamp.After(latestFrame.Timestamp) {
			return false // Frame rejected as it's not newer
		}
	}

	rb.frames[rb.head] = frame
	rb.head = (rb.head + 1) % rb.capacity
	rb.frameCount++

	if rb.size < rb.capacity {
		rb.size++
	} else {
		rb.tail = (rb.tail + 1) % rb.capacity
	}
	
	return true // Frame accepted
}

// GetLatest returns the most recent frame
func (rb *RingBuffer) GetLatest() *Frame {
	rb.mutex.RLock()
	defer rb.mutex.RUnlock()

	if rb.size == 0 {
		return nil
	}

	lastIndex := rb.head - 1
	if lastIndex < 0 {
		lastIndex = rb.capacity - 1
	}
	return rb.frames[lastIndex]
}

// GetAll returns all frames in chronological order
func (rb *RingBuffer) GetAll() []*Frame {
	rb.mutex.RLock()
	defer rb.mutex.RUnlock()

	if rb.size == 0 {
		return []*Frame{}
	}

	frames := make([]*Frame, rb.size)
	for i := 0; i < rb.size; i++ {
		index := (rb.tail + i) % rb.capacity
		frames[i] = rb.frames[index]
	}
	return frames
}

// GetStats returns buffer statistics
func (rb *RingBuffer) GetStats() map[string]interface{} {
	rb.mutex.RLock()
	defer rb.mutex.RUnlock()

	var latestTimestamp time.Time
	if rb.size > 0 {
		lastIndex := rb.head - 1
		if lastIndex < 0 {
			lastIndex = rb.capacity - 1
		}
		latestTimestamp = rb.frames[lastIndex].Timestamp
	}

	return map[string]interface{}{
		"size":             rb.size,
		"capacity":         rb.capacity,
		"frameCount":       rb.frameCount,
		"latestTimestamp":  latestTimestamp,
	}
}

// Client represents a connected webcam client
type Client struct {
	ID          string
	Buffer      *RingBuffer
	LastSeen    time.Time
	Connection  *websocket.Conn
	mutex       sync.RWMutex
}

// StreamServer manages all clients and their streams
type StreamServer struct {
	clients    map[string]*Client
	mutex      sync.RWMutex
	upgrader   websocket.Upgrader
	bufferSize int
}

// NewStreamServer creates a new stream server
func NewStreamServer(bufferSize int) *StreamServer {
	return &StreamServer{
		clients:    make(map[string]*Client),
		bufferSize: bufferSize,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for development
			},
			ReadBufferSize:  4096,  // Increased buffer sizes
			WriteBufferSize: 4096,
			EnableCompression: false, // Disable compression for better performance
		},
	}
}

// AddClient adds or updates a client
func (ss *StreamServer) AddClient(clientID string, conn *websocket.Conn) {
	ss.mutex.Lock()
	defer ss.mutex.Unlock()

	// Check if client already exists and close old connection
	if existingClient, exists := ss.clients[clientID]; exists {
		log.Printf("Client %s reconnecting, closing old connection", clientID)
		if existingClient.Connection != nil {
			existingClient.Connection.Close()
		}
	}

	client := &Client{
		ID:         clientID,
		Buffer:     NewRingBuffer(ss.bufferSize),
		LastSeen:   time.Now(),
		Connection: conn,
	}
	
	ss.clients[clientID] = client
	log.Printf("✅ Client %s connected (total: %d)", clientID, len(ss.clients))
}

// RemoveClient removes a client
func (ss *StreamServer) RemoveClient(clientID string) {
	ss.mutex.Lock()
	defer ss.mutex.Unlock()

	if client, exists := ss.clients[clientID]; exists {
		if client.Connection != nil {
			client.Connection.Close()
		}
		delete(ss.clients, clientID)
		log.Printf("Client %s disconnected", clientID)
	}
}

// GetClient returns a client by ID
func (ss *StreamServer) GetClient(clientID string) (*Client, bool) {
	ss.mutex.RLock()
	defer ss.mutex.RUnlock()
	client, exists := ss.clients[clientID]
	return client, exists
}

// GetAllClients returns all client IDs
func (ss *StreamServer) GetAllClients() []string {
	ss.mutex.RLock()
	defer ss.mutex.RUnlock()

	clientIDs := make([]string, 0, len(ss.clients))
	for clientID := range ss.clients {
		clientIDs = append(clientIDs, clientID)
	}
	return clientIDs
}

// AddFrame adds a frame to a client's buffer
func (ss *StreamServer) AddFrame(clientID string, frameData []byte) error {
	client, exists := ss.GetClient(clientID)
	if !exists {
		return fmt.Errorf("client %s not found", clientID)
	}

	frame := &Frame{
		Data:      frameData,
		Timestamp: time.Now(),
		Size:      len(frameData),
		Format:    "jpeg", // Assume JPEG for now
	}

	// Try to add the frame to the buffer
	if !client.Buffer.Add(frame) {
		// Frame was rejected because it's not newer than the latest frame
		log.Printf("⚠️ Rejected out-of-order frame from %s (frame timestamp: %v)", clientID, frame.Timestamp)
		return nil // Don't treat this as an error, just skip the frame
	}

	client.mutex.Lock()
	client.LastSeen = time.Now()
	client.mutex.Unlock()

	// Check if we should broadcast this frame (rate limiting for viewers)
	shouldBroadcast := ss.shouldBroadcastFrame(clientID, frame)
	
	if shouldBroadcast {
		// Log frame reception only when broadcasting
		log.Printf("📸 Accepted & broadcasting frame from %s: %d bytes", clientID, len(frameData))
		// Broadcast to streaming subscribers only if frame was accepted
		ss.broadcastFrame(clientID, frame)
	} else {
		// Log frame reception but note it's rate limited
		log.Printf("📸 Accepted frame from %s: %d bytes (rate limited, not broadcasting)", clientID, len(frameData))
	}

	return nil
}

// Rate limiting for broadcasting - prevents overwhelming viewers
var lastBroadcastTime = make(map[string]time.Time)
var broadcastMutex sync.RWMutex

const MAX_BROADCAST_FPS = 25 // Increased from 20 to 25 FPS to reduce disconnections
const MIN_BROADCAST_INTERVAL = time.Duration(1000/MAX_BROADCAST_FPS) * time.Millisecond // 40ms

func (ss *StreamServer) shouldBroadcastFrame(clientID string, frame *Frame) bool {
	broadcastMutex.Lock()
	defer broadcastMutex.Unlock()
	
	lastTime, exists := lastBroadcastTime[clientID]
	now := time.Now()
	
	// More lenient timing - allow if 90% of interval has passed
	if !exists || now.Sub(lastTime) >= MIN_BROADCAST_INTERVAL*9/10 {
		lastBroadcastTime[clientID] = now
		return true
	}
	
	return false
}

// Message types for WebSocket communication
type WSMessage struct {
	Type      string      `json:"type"`
	ClientID  string      `json:"clientId,omitempty"`
	Payload   interface{} `json:"payload,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

// StreamingClient wraps a WebSocket connection with a mutex for safe concurrent writes
type StreamingClient struct {
	conn  *websocket.Conn
	mutex sync.Mutex
}

// SafeWriteMessage writes a message to the WebSocket connection with mutex protection
func (sc *StreamingClient) SafeWriteMessage(messageType int, data []byte) error {
	sc.mutex.Lock()
	defer sc.mutex.Unlock()
	
	// Set write deadline
	sc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return sc.conn.WriteMessage(messageType, data)
}

// WebSocket connections for streaming
var streamSubscribers = make(map[*StreamingClient]bool)
var subscribersMutex sync.RWMutex

// broadcastFrame broadcasts a frame to all streaming subscribers
func (ss *StreamServer) broadcastFrame(clientID string, frame *Frame) {
	subscribersMutex.RLock()
	subscribers := make([]*StreamingClient, 0, len(streamSubscribers))
	for client := range streamSubscribers {
		subscribers = append(subscribers, client)
	}
	subscribersMutex.RUnlock()

	if len(subscribers) == 0 {
		return // No subscribers, skip broadcasting
	}

	// Get client buffer stats for the broadcast message
	client, exists := ss.GetClient(clientID)
	var stats map[string]interface{}
	if exists {
		stats = client.Buffer.GetStats()
	} else {
		stats = map[string]interface{}{
			"frameCount": 0,
			"size": 0,
		}
	}

	// Encode frame data as base64 for JSON transmission
	base64Data := base64.StdEncoding.EncodeToString(frame.Data)

	message := map[string]interface{}{
		"type":      "frame_update",
		"clientId":  clientID,
		"image":     fmt.Sprintf("data:image/jpeg;base64,%s", base64Data),
		"timestamp": frame.Timestamp,
		"size":      frame.Size,
		"format":    frame.Format,
		"stats":     stats, // Include buffer statistics
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling broadcast message: %v", err)
		return
	}

	// Broadcast to all subscribers with proper error handling
	var failedConnections []*StreamingClient
	
	log.Printf("📡 Broadcasting frame from %s to %d subscribers (frame count: %v)", 
		clientID, len(subscribers), stats["frameCount"])
	
	for _, client := range subscribers {
		if err := client.SafeWriteMessage(websocket.TextMessage, data); err != nil {
			// Connection failed, mark for removal
			failedConnections = append(failedConnections, client)
			log.Printf("Failed to broadcast to client, removing: %v", err)
		}
	}
	
	// Clean up failed connections
	if len(failedConnections) > 0 {
		subscribersMutex.Lock()
		for _, failedClient := range failedConnections {
			delete(streamSubscribers, failedClient)
			failedClient.conn.Close()
		}
		subscribersMutex.Unlock()
		log.Printf("Removed %d failed streaming connections", len(failedConnections))
	}
}

// cleanupInactiveClients removes clients that haven't been seen recently
func (ss *StreamServer) cleanupInactiveClients() {
	ticker := time.NewTicker(CLEANUP_INTERVAL)
	defer ticker.Stop()

	for range ticker.C {
		ss.mutex.Lock()
		now := time.Now()
		var toRemove []string

		for clientID, client := range ss.clients {
			client.mutex.RLock()
			if now.Sub(client.LastSeen) > CLIENT_TIMEOUT {
				toRemove = append(toRemove, clientID)
			}
			client.mutex.RUnlock()
		}

		for _, clientID := range toRemove {
			delete(ss.clients, clientID)
			log.Printf("Cleaned up inactive client: %s", clientID)
		}
		ss.mutex.Unlock()
	}
}

// HTTP Handlers

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		
		// Handle preflight OPTIONS request
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

func (ss *StreamServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := ss.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ WebSocket upgrade error: %v", err)
		return
	}

	var clientID string
	var registered bool
	
	// Set connection timeouts
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	
	// Set ping/pong handlers for connection health
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	defer func() {
		if clientID != "" && registered {
			ss.RemoveClient(clientID)
		}
		conn.Close()
		log.Printf("🔌 Connection closed for client: %s", clientID)
	}()

	log.Printf("🔗 New WebSocket connection from %s", r.RemoteAddr)

	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("❌ WebSocket error for client %s: %v", clientID, err)
			} else {
				log.Printf("🔌 Client %s disconnected normally", clientID)
			}
			break
		}

		// Reset read deadline on successful message
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		switch messageType {
		case websocket.TextMessage:
			// Handle JSON messages (registration, metadata)
			var msg WSMessage
			if err := json.Unmarshal(data, &msg); err != nil {
				log.Printf("❌ JSON parse error from %s: %v", r.RemoteAddr, err)
				continue
			}

			if msg.Type == "client-registration" && msg.ClientID != "" {
				if clientID != "" && clientID != msg.ClientID {
					log.Printf("⚠️ Client ID change attempt: %s -> %s", clientID, msg.ClientID)
					continue
				}
				
				clientID = msg.ClientID
				ss.AddClient(clientID, conn)
				registered = true
				
				// Send confirmation back to client
				response := map[string]interface{}{
					"type": "registration-success",
					"clientId": clientID,
					"timestamp": time.Now(),
				}
				if responseData, err := json.Marshal(response); err == nil {
					conn.WriteMessage(websocket.TextMessage, responseData)
				}
			}

		case websocket.BinaryMessage:
			// Handle binary frame data
			if !registered || clientID == "" {
				log.Printf("⚠️ Received binary data from unregistered client %s", r.RemoteAddr)
				continue
			}
			
			if len(data) > 0 && len(data) <= MAX_FRAME_SIZE {
				if err := ss.AddFrame(clientID, data); err != nil {
					log.Printf("❌ Error adding frame from %s: %v", clientID, err)
				}
			} else if len(data) > MAX_FRAME_SIZE {
				log.Printf("⚠️ Frame too large from %s: %d bytes", clientID, len(data))
			}
		}
	}
}

func (ss *StreamServer) handleStreamingWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := ss.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ Streaming WebSocket upgrade error: %v", err)
		return
	}

	// Set connection timeouts
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	
	// Set ping/pong handlers
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	subscriber := &StreamingClient{conn: conn}

	subscribersMutex.Lock()
	streamSubscribers[subscriber] = true
	subscriberCount := len(streamSubscribers)
	subscribersMutex.Unlock()

	log.Printf("📺 Streaming client connected (total viewers: %d)", subscriberCount)

	defer func() {
		subscribersMutex.Lock()
		delete(streamSubscribers, subscriber)
		remainingCount := len(streamSubscribers)
		subscribersMutex.Unlock()
		conn.Close()
		log.Printf("📺 Streaming client disconnected (remaining viewers: %d)", remainingCount)
	}()

	// Send current frames immediately to new subscriber
	go func() {
		for _, clientID := range ss.GetAllClients() {
			if client, exists := ss.GetClient(clientID); exists {
				if frame := client.Buffer.GetLatest(); frame != nil {
					message := map[string]interface{}{
						"type":      "frame_update",
						"clientId":  clientID,
						"image":     fmt.Sprintf("data:image/jpeg;base64,%s", base64.StdEncoding.EncodeToString(frame.Data)),
						"timestamp": frame.Timestamp,
						"size":      frame.Size,
						"format":    frame.Format,
					}
					if data, err := json.Marshal(message); err == nil {
						subscriber.SafeWriteMessage(websocket.TextMessage, data)
					}
				}
			}
		}
	}()

	// Keep connection alive and handle incoming messages
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("❌ Streaming WebSocket error: %v", err)
			}
			break
		}
		// Reset read deadline on any message
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	}
}

func (ss *StreamServer) handleGetClients(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	clients := ss.GetAllClients()
	response := map[string]interface{}{
		"success": true,
		"count":   len(clients),
		"clients": clients,
	}

	json.NewEncoder(w).Encode(response)
}

func (ss *StreamServer) handleGetClientStream(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	clientID := vars["id"]

	client, exists := ss.GetClient(clientID)
	if !exists {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Client %s not found", clientID),
		})
		return
	}

	frames := client.Buffer.GetAll()
	response := map[string]interface{}{
		"success":  true,
		"clientId": clientID,
		"frames":   frames,
		"count":    len(frames),
		"stats":    client.Buffer.GetStats(),
	}

	json.NewEncoder(w).Encode(response)
}

func (ss *StreamServer) handleGetLatestFrame(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	clientID := vars["id"]

	client, exists := ss.GetClient(clientID)
	if !exists {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Client %s not found", clientID),
		})
		return
	}

	frame := client.Buffer.GetLatest()
	if frame == nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No frames available",
		})
		return
	}

	// Fix: Properly encode binary data to base64
	base64Data := base64.StdEncoding.EncodeToString(frame.Data)

	response := map[string]interface{}{
		"success": true,
		"clientId": clientID,
		"image":   fmt.Sprintf("data:image/jpeg;base64,%s", base64Data),
		"timestamp": frame.Timestamp,
		"size":     frame.Size,
		"stats":    client.Buffer.GetStats(),
	}

	json.NewEncoder(w).Encode(response)
}

func (ss *StreamServer) handleGetAllStreams(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	allStreams := make(map[string]interface{})
	
	for _, clientID := range ss.GetAllClients() {
		if client, exists := ss.GetClient(clientID); exists {
			frames := client.Buffer.GetAll()
			allStreams[clientID] = map[string]interface{}{
				"frames": frames,
				"count":  len(frames),
				"stats":  client.Buffer.GetStats(),
			}
		}
	}

	response := map[string]interface{}{
		"success": true,
		"streams": allStreams,
		"totalClients": len(allStreams),
	}

	json.NewEncoder(w).Encode(response)
}

func (ss *StreamServer) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	stats := map[string]interface{}{
		"status":       "healthy",
		"totalClients": len(ss.clients),
		"bufferSize":   ss.bufferSize,
		"timestamp":    time.Now(),
		"streamSubscribers": len(streamSubscribers),
	}

	json.NewEncoder(w).Encode(stats)
}

func main() {
	bufferSize := BUFFER_SIZE
	port := ":8080"

	server := NewStreamServer(bufferSize)

	// Start cleanup routine
	go server.cleanupInactiveClients()

	// Setup routes
	r := mux.NewRouter()

	// Apply CORS middleware to all routes
	r.Use(corsMiddleware)

	// WebSocket endpoints
	r.HandleFunc("/ws", server.handleWebSocket)
	r.HandleFunc("/stream/ws", server.handleStreamingWebSocket)

	// REST API endpoints
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", server.handleHealthCheck).Methods("GET", "OPTIONS")
	api.HandleFunc("/clients", server.handleGetClients).Methods("GET", "OPTIONS")
	api.HandleFunc("/clients/{id}/stream", server.handleGetClientStream).Methods("GET", "OPTIONS")
	api.HandleFunc("/clients/{id}/latest", server.handleGetLatestFrame).Methods("GET", "OPTIONS")
	api.HandleFunc("/streams", server.handleGetAllStreams).Methods("GET", "OPTIONS")

	log.Printf("🚀 SkySentry Go Server starting on port %s", port)
	log.Printf("📊 WebSocket endpoint: ws://localhost%s/ws", port)
	log.Printf("📡 Streaming endpoint: ws://localhost%s/stream/ws", port)
	log.Printf("🔥 REST API: http://localhost%s/api", port)
	log.Printf("💾 Ring buffer size: %d frames per client", bufferSize)

	if err := http.ListenAndServe(port, r); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}