package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

const (
	BUFFER_SIZE       = 32
	MAX_FRAME_SIZE    = 2 * 1024 * 1024
	CLEANUP_INTERVAL  = 60 * time.Second
	CLIENT_TIMEOUT    = 5 * time.Minute
	MAX_BROADCAST_FPS = 60
)

// Frame represents a single webcam frame
type Frame struct {
	Data      []byte    `json:"data"`
	Timestamp time.Time `json:"timestamp"`
	Size      int       `json:"size"`
	Format    string    `json:"format"`
}

// RingBuffer is a circular buffer for frames
type RingBuffer struct {
	frames     []*Frame
	head       int
	capacity   int
	size       int
	mutex      sync.RWMutex
	frameCount uint64
}

func NewRingBuffer(capacity int) *RingBuffer {
	return &RingBuffer{
		frames:   make([]*Frame, capacity),
		capacity: capacity,
	}
}

func (rb *RingBuffer) Add(frame *Frame) {
	rb.mutex.Lock()
	defer rb.mutex.Unlock()

	rb.frames[rb.head] = frame
	rb.head = (rb.head + 1) % rb.capacity
	rb.frameCount++
	if rb.size < rb.capacity {
		rb.size++
	}
}

func (rb *RingBuffer) GetLatest() *Frame {
	rb.mutex.RLock()
	defer rb.mutex.RUnlock()
	if rb.size == 0 {
		return nil
	}
	lastIndex := (rb.head - 1 + rb.capacity) % rb.capacity
	return rb.frames[lastIndex]
}

// Client represents a connected webcam producer
type Client struct {
	ID         string
	Buffer     *RingBuffer
	LastSeen   time.Time
	conn       *websocket.Conn
	mutex      sync.RWMutex
	timestamps []time.Time
	fps        float64
}

// StreamServer manages all clients and viewers
type StreamServer struct {
	clients    map[string]*Client
	mutex      sync.RWMutex
	upgrader   websocket.Upgrader
	bufferSize int
}

func NewStreamServer(bufferSize int) *StreamServer {
	return &StreamServer{
		clients:    make(map[string]*Client),
		bufferSize: bufferSize,
		upgrader: websocket.Upgrader{
			CheckOrigin:       func(r *http.Request) bool { return true },
			ReadBufferSize:    1024,
			WriteBufferSize:   1024,
			EnableCompression: false,
		},
	}
}

func (ss *StreamServer) AddClient(clientID string, conn *websocket.Conn) {
	ss.mutex.Lock()
	defer ss.mutex.Unlock()
	if existing, ok := ss.clients[clientID]; ok {
		existing.conn.Close()
	}
	ss.clients[clientID] = &Client{
		ID:         clientID,
		Buffer:     NewRingBuffer(ss.bufferSize),
		LastSeen:   time.Now(),
		conn:       conn,
		timestamps: make([]time.Time, 0, 10),
	}
}

func (ss *StreamServer) RemoveClient(clientID string) {
	ss.mutex.Lock()
	defer ss.mutex.Unlock()
	if client, ok := ss.clients[clientID]; ok {
		client.conn.Close()
		delete(ss.clients, clientID)
	}
}

func (ss *StreamServer) GetClient(clientID string) (*Client, bool) {
	ss.mutex.RLock()
	defer ss.mutex.RUnlock()
	client, ok := ss.clients[clientID]
	return client, ok
}

func (ss *StreamServer) AddFrame(clientID string, frameData []byte) {
	client, ok := ss.GetClient(clientID)
	if !ok {
		return
	}
	frame := &Frame{
		Data:      frameData,
		Timestamp: time.Now(),
		Size:      len(frameData),
		Format:    "jpeg",
	}
	client.Buffer.Add(frame)
	client.mutex.Lock()
	client.LastSeen = frame.Timestamp
	client.timestamps = append(client.timestamps, frame.Timestamp)
	if len(client.timestamps) > 10 {
		client.timestamps = client.timestamps[1:]
	}
	if len(client.timestamps) > 1 {
		intervals := make([]time.Duration, 0, len(client.timestamps)-1)
		for i := 1; i < len(client.timestamps); i++ {
			intervals = append(intervals, client.timestamps[i].Sub(client.timestamps[i-1]))
		}
		avgInterval := 0.0
		for _, d := range intervals {
			avgInterval += d.Seconds()
		}
		avgInterval /= float64(len(intervals))
		client.fps = 1.0 / avgInterval
	} else {
		client.fps = 0
	}
	client.mutex.Unlock()

	go ss.broadcastFrame(clientID, frame)
}

// Viewer represents a subscribed client with a buffered channel for non-blocking sends.
type Viewer struct {
	conn *websocket.Conn
	send chan []byte // Buffered channel for outgoing messages
}

var viewers = make(map[*Viewer]bool)
var viewersMutex sync.RWMutex

// broadcastFrame sends a frame to all subscribed viewers using non-blocking channel sends.
func (ss *StreamServer) broadcastFrame(clientID string, frame *Frame) {
	viewersMutex.RLock()
	defer viewersMutex.RUnlock()

	if len(viewers) == 0 {
		return
	}

	client, ok := ss.GetClient(clientID)
	if !ok {
		return
	}

	msg := map[string]interface{}{
		"type":      "frame_update",
		"clientId":  clientID,
		"image":     fmt.Sprintf("data:image/jpeg;base64,%s", base64.StdEncoding.EncodeToString(frame.Data)),
		"timestamp": frame.Timestamp,
		"size":      frame.Size,
		"stats":     map[string]interface{}{"frameCount": client.Buffer.frameCount, "fps": client.fps},
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	for viewer := range viewers {
		select {
		case viewer.send <- data:
		// Message sent successfully (or buffered).
		default:
			// Channel is full. Client is too slow. Drop the frame.
			log.Printf("Dropping frame for slow viewer. Connection: %s", viewer.conn.RemoteAddr())
		}
	}
}

func (ss *StreamServer) cleanupInactiveClients() {
	ticker := time.NewTicker(CLEANUP_INTERVAL)
	defer ticker.Stop()
	for range ticker.C {
		ss.mutex.Lock()
		for id, client := range ss.clients {
			if time.Since(client.LastSeen) > CLIENT_TIMEOUT {
				delete(ss.clients, id)
				client.conn.Close()
				log.Printf("Cleaned up inactive client: %s", id)
			}
		}
		ss.mutex.Unlock()
	}
}

// HTTP Handlers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
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
		return
	}
	var clientID string
	var registered bool
	defer func() {
		if registered {
			ss.RemoveClient(clientID)
		}
		conn.Close()
	}()

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		if msgType == websocket.TextMessage {
			var msg map[string]string
			if json.Unmarshal(data, &msg) == nil && msg["type"] == "client-registration" {
				clientID = msg["clientId"]
				ss.AddClient(clientID, conn)
				registered = true
				conn.WriteJSON(map[string]string{"type": "registration-success", "clientId": clientID})
			}
		} else if msgType == websocket.BinaryMessage && registered {
			ss.AddFrame(clientID, data)
		}
	}
}

// writePump pumps messages from the channel to the websocket connection.
func (v *Viewer) writePump() {
	defer func() {
		v.conn.Close()
	}()
	for {
		message, ok := <-v.send
		if !ok {
			// The channel has been closed.
			v.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}
		v.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := v.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return
		}
	}
}

func (ss *StreamServer) handleStreamingWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := ss.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	viewer := &Viewer{conn: conn, send: make(chan []byte, 1024)} // Buffered channel for non-blocking sends
	
	viewersMutex.Lock()
	viewers[viewer] = true
	viewersMutex.Unlock()

	go viewer.writePump()

	// Keep the connection alive by reading messages (and discarding them)
	defer func() {
		viewersMutex.Lock()
		delete(viewers, viewer)
		close(viewer.send)
		viewersMutex.Unlock()
	}()
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

func (ss *StreamServer) handleGetClients(w http.ResponseWriter, r *http.Request) {
	ss.mutex.RLock()
	defer ss.mutex.RUnlock()
	clientIDs := make([]string, 0, len(ss.clients))
	for id := range ss.clients {
		clientIDs = append(clientIDs, id)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(clientIDs)
}

func (ss *StreamServer) handleGetLatestFrame(w http.ResponseWriter, r *http.Request) {
	clientID := mux.Vars(r)["id"]
	client, ok := ss.GetClient(clientID)
	if !ok {
		http.NotFound(w, r)
		return
	}
	frame := client.Buffer.GetLatest()
	if frame == nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"clientId":  clientID,
		"image":     fmt.Sprintf("data:image/jpeg;base64,%s", base64.StdEncoding.EncodeToString(frame.Data)),
		"timestamp": frame.Timestamp,
		"size":      frame.Size,
		"stats":     map[string]interface{}{"frameCount": client.Buffer.frameCount, "fps": client.fps},
	})
}

func main() {
	port := ":8080"
	server := NewStreamServer(BUFFER_SIZE)
	go server.cleanupInactiveClients()

	r := mux.NewRouter()
	r.Use(corsMiddleware)
	r.HandleFunc("/ws", server.handleWebSocket)
	r.HandleFunc("/stream/ws", server.handleStreamingWebSocket)
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/clients", server.handleGetClients).Methods("GET")
	api.HandleFunc("/clients/{id}/latest", server.handleGetLatestFrame).Methods("GET")

	log.Printf("🚀 Server starting on port %s", port)
	http.ListenAndServe(port, r)
}