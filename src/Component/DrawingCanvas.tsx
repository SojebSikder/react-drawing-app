import React, { useRef, useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const DrawingCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [color, setColor] = useState<string>("#000");
  const [lineWidth, setLineWidth] = useState<number>(2);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const socket = useRef<Socket | null>(null);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  // const updateCanvasSize = () => {
  //   if (canvasRef.current) {
  //     const canvas = canvasRef.current;
  //     canvas.width = window.innerWidth * 0.8; // Responsive width
  //     canvas.height = window.innerHeight * 0.6; // Responsive height
  //   }
  // };
  const updateCanvasSize = () => {
    if (!canvasRef.current || !ctx) return;

    // Save current canvas content
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      tempCtx.drawImage(canvasRef.current, 0, 0);
    }

    // Resize the canvas
    canvasRef.current.width = window.innerWidth * 0.8;
    canvasRef.current.height = window.innerHeight * 0.6;

    // Restore the saved content
    if (tempCtx) {
      ctx.drawImage(tempCanvas, 0, 0);
    }
  };

  useEffect(() => {
    socket.current = io("http://localhost:3000"); // Server URL

    socket.current.on("connect", () => {
      console.log("Connected to server");
    });

    // Listen for draw start event
    socket.current.on("drawStart", (data) => {
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      }
    });
    // Listen for draw events from other clients
    socket.current.on("draw", (data) => {
      if (ctx) {
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.lineWidth;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
        ctx.lineTo(data.x2, data.y2);
        ctx.stroke();
      }
    });

    return () => {
      socket.current?.disconnect();
    };
  }, [ctx]);

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

      // Store last position
      setLastPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
      // Emit start event
      socket.current?.emit("drawStart", {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
        color,
        lineWidth,
      });
    },
    [ctx, color, lineWidth]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !ctx || !lastPos) return;

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = isEraser ? "#fff" : color;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      ctx.stroke();
      // Emit smoother drawing data
      socket.current?.emit("draw", {
        x: lastPos.x,
        y: lastPos.y,
        x2: e.nativeEvent.offsetX,
        y2: e.nativeEvent.offsetY,
        color,
        lineWidth,
      });
      // Update last position
      setLastPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    },
    [isDrawing, ctx, color, lineWidth, isEraser, lastPos]
  );

  const stopDrawing = useCallback(() => {
    if (!ctx) return;
    setIsDrawing(false);
    setLastPos(null);
    ctx.closePath();

    // Emit end of drawing
    socket.current?.emit("drawEnd");
  }, [ctx]);

  const clearCanvas = () => {
    if (!ctx || !canvasRef.current) return;
    saveState();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const saveImage = () => {
    if (!canvasRef.current) return;
    const imageUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "drawing.png";
    link.click();
  };

  const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            setImage(img);
            if (ctx && canvasRef.current) {
              // Draw the image onto the canvas
              ctx.drawImage(
                img,
                0,
                0,
                canvasRef.current.width,
                canvasRef.current.height
              );
            }
          };
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Set cursor styles based on the current operation
  useEffect(() => {
    if (canvasRef.current) {
      if (isDrawing || isEraser) {
        canvasRef.current.style.cursor = "crosshair";
      } else {
        canvasRef.current.style.cursor = "default";
      }
    }
  }, [isDrawing, isEraser]);

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
        <label>
          Insert Image:
          <input
            type="file"
            accept="image/*"
            onChange={handleImageInsert}
            className="ml-2"
          />
        </label>
        <button
          onClick={() => setIsEraser((prev) => !prev)}
          className={`p-2 ${
            isEraser ? "bg-red-500" : "bg-gray-500"
          } text-white rounded`}
        >
          {isEraser ? "Disable Eraser" : "Enable Eraser"}
        </button>
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
        <button
          onClick={saveImage}
          className="p-2 bg-yellow-500 text-white rounded"
        >
          Save Image
        </button>
      </div>
    </div>
  );
};

export default DrawingCanvas;
