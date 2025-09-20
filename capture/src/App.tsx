import React from "react";
import SkySentryClient from "./SkySentryClient";

// Generate random 6-digit ID
function generateClientId(): string {
  const randomId = Math.floor(100000 + Math.random() * 900000);
  return `demo-client-${randomId}`;
}

function App() {
  // Generate a unique client ID on app load
  const clientId = React.useMemo(() => generateClientId(), []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>SkySentry Capture Client</h1>
        <p>High-Performance Real-Time Streaming</p>
      </header>

      <main>
        <SkySentryClient
          clientId={clientId}
          autoStartCamera={true}
          frameRate={20} // Optimized for smooth streaming
        />
      </main>
    </div>
  );
}

export default App;
