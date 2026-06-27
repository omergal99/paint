# Future Roadmap & Extension Ideas

This document outlines high-value features, optimizations, and extension ideas for future iterations of **omerpaint**.

---

## 1. Right Sidebar History Panel
- **Description**: Add a togglable sidebar on the right displaying the last 10 canvas actions (strokes, selections, pastes, resizes).
- **UX**: Clicking on any previous history item will instantly revert the canvas state to that specific point. It makes the undo/redo stack visible and navigable.

## 2. Advanced Rotation & Transformation
- **Description**: Add rotation, flipping, and shearing capabilities.
- **Controls**:
  - Rotate selection (or entire canvas) by 90°, 180°, or 270°.
  - Free-transform handles on the selection box to rotate by arbitrary angles, or scale/stretch the selection.
  - Horizontal and vertical flipping.

## 3. Background Removal Action
- **Description**: A tool to remove the background of the selected area or make it transparent.
- **Implementation**:
  - Can be launched via a separate dialog or context action.
  - Basic mode: Key out a selected color (chroma keying/transparency mask).
  - Advanced mode: Integrate a client-side AI model (like WebNN or MediaPipe Selfie Segmenter) to automatically isolate foreground objects from their background.

## 4. VS Code-Style AI Chat Sidebar
- **Description**: Integrate an AI chat panel on the right sidebar.
- **Workflow**:
  - The user can type natural language instructions (e.g., *"Make the colors more vibrant"*, *"Add a small cat icon in the bottom right corner"*, or *"Convert this image to grayscale"*).
  - The AI assistant interprets the prompt, operates on the canvas pixels or selection area, and replaces it with the modified result.

## 5. Eyedropper Magnifier Balloon
- **Description**: Show a magnified pixel-grid balloon above the cursor when using the Eyedropper tool.
- **UX**: When moving the eyedropper, the balloon displays a zoomed-in grid (e.g., 9x9 pixels) around the cursor with the center pixel highlighted, showing the color values in real-time. This helps the user pick colors with single-pixel accuracy.

## 6. Custom Settings & Workspace Layout
- **Description**: Add a settings menu to let users configure the workspace.
- **Customization Options**:
  - Toggle elements on/off (e.g., show/hide color inspector, rulers, status bar, or gridlines).
  - Light/Dark mode themes.
  - Custom canvas background templates (grids, transparent checkerboard, lined paper).

## 7. Smarter Deselection (Already Implemented)
- **Description**: Clicking outside the active paint canvas on the grey viewport background commits the selection and removes the outline.
- **Status**: **Implemented** in `js/main.js`. Clicking on the scrollable stage background successfully commits and clears the selection state, solving the issue of sticky selection borders after `Ctrl+A`.
