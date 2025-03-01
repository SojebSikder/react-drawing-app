import React, { useRef, useState, useEffect, useCallback } from "react";

const DrawingCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [color, setColor] = useState<string>("#000");
  const [lineWidth, setLineWidth] = useState<number>(2);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);

  const updateCanvasSize = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = window.innerWidth * 0.8; // Responsive width
      canvas.height = window.innerHeight * 0.6; // Responsive height
    }
  };

  useEffect(() => {
    updateCanvasSize();
    if (canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        context.lineCap = "round";
        setCtx(context);
      }
    }

    // Update canvas size on window resize
    window.addEventListener("resize", updateCanvasSize);
    return () => {
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, []);

  const saveState = () => {
    if (!ctx || !canvasRef.current) return;
    const snapshot = ctx.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    setHistory((prev) => [...prev, snapshot]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const undo = () => {
    if (!ctx || !canvasRef.current || history.length === 0) return;
    setRedoStack((prev) => [
      ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height),
      ...prev,
    ]);
    setHistory((prev) => {
      const newHistory = [...prev];
      const previousState = newHistory.pop();
      if (previousState) ctx.putImageData(previousState, 0, 0);
      return newHistory;
    });
  };

  const redo = () => {
    if (!ctx || !canvasRef.current || redoStack.length === 0) return;
    setHistory((prev) => [
      ...prev,
      ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height),
    ]);
    setRedoStack((prev) => {
      const newRedoStack = [...prev];
      const nextState = newRedoStack.shift();
      if (nextState) ctx.putImageData(nextState, 0, 0);
      return newRedoStack;
    });
  };

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!ctx) return;
      saveState();
      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    },
    [ctx]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !ctx) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      ctx.stroke();
    },
    [isDrawing, ctx, color, lineWidth]
  );

  const stopDrawing = useCallback(() => {
    if (!ctx) return;
    setIsDrawing(false);
    ctx.closePath();
  }, [ctx]);

  const clearCanvas = () => {
    if (!ctx || !canvasRef.current) return;
    saveState();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  return (
    <div className="flex flex-col items-center p-4">
      <div className="flex space-x-4 mb-4">
        <label>
          Brush Color:
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="ml-2"
          />
        </label>
        <label>
          Brush Size:
          <input
            type="range"
            min="1"
            max="10"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="ml-2"
          />
        </label>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="border-1 border-black rounded-lg shadow-md"
      />
      <div className="mt-4 space-x-2">
        <button onClick={undo} className="p-2 bg-blue-500 text-white rounded">
          Undo
        </button>
        <button onClick={redo} className="p-2 bg-green-500 text-white rounded">
          Redo
        </button>
        <button
          onClick={clearCanvas}
          className="p-2 bg-red-500 text-white rounded"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default DrawingCanvas;
