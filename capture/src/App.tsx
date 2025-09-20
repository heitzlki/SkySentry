import "./App.css";
import SkySentryClient from "./SkySentryClient";

function App() {
  // Generate a random 6-digit number for the client ID
  const randomClientId = `demo-client-${Math.floor(
    100000 + Math.random() * 900000
  )}`;

  return (
    <>
      <div>
        <h1>SkySentry Demo</h1>
        <p>Clean blackbox WebRTC/WebSocket interface</p>

        {/* Simple usage - just pass a client ID */}
        <SkySentryClient
          clientId={randomClientId}
          autoStartCamera={true}
          frameRate={50}
        />

        {/* You can easily add more clients */}
        <hr style={{ margin: "40px 0" }} />
        {/* <SkySentryClient clientId="demo-client-002" /> */}
      </div>
    </>
  );
}

export default App;
