import SkySentryClient from "./SkySentryClient";

function App() {
  // Generate a unique client ID on app load

  return (
    <div className="App">
      <header className="App-header">
        <h1>SkySentry Capture Client</h1>
        <p>High-Performance Real-Time Streaming with Camera Selection</p>
      </header>

      <main>
        <SkySentryClient
          // clientId={clientId}
          clientId={"demo"}
          // autoStartCamera={false} // Disabled by default - let users choose camera first
          frameRate={10} // Limited to 10 FPS for optimal performance
        />
      </main>
    </div>
  );
}

export default App;
