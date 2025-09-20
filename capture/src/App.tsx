import "./App.css";
import SkySentryClient from "./SkySentryClient";

function App() {
  return (
    <>
      <div>
        <h1>SkySentry Demo</h1>
        <p>Clean blackbox WebRTC/WebSocket interface</p>

        {/* Simple usage - just pass a client ID */}
        <SkySentryClient
          clientId="demo-client-001"
          autoStartCamera={true}
          frameRate={100}
        />

        {/* You can easily add more clients */}
        <hr style={{ margin: "40px 0" }} />
        {/* <SkySentryClient clientId="demo-client-002" /> */}
      </div>
    </>
  );
}

export default App;
