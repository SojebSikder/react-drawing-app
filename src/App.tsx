import "./App.css";
import DrawingCanvas from "./Component/DrawingCanvas";

function App() {
  return (
    <>
      <div className="flex flex-col items-center p-4">
        <h1 className="text-xl font-bold mb-4">Drawing App</h1>
        <DrawingCanvas />
      </div>
    </>
  );
}

export default App;
