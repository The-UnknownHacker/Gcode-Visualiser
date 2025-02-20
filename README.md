# GCode Visualizer

A powerful web-based GCode visualization tool that provides both 2D flow visualization and 3D preview capabilities for 3D printing GCode files.

## Features

### 2D Flow Visualization
- Visual representation of GCode commands as interactive nodes
- Command grouping and stacking for better visualization
- Color-coded commands by type:
  - Movement commands (blue)
  - Temperature controls (red)
  - Bed temperature (orange)
  - Fan controls (green)
  - Homing commands (purple)
  - Other commands (gray)
- Virtual scrolling for efficient rendering of large files
- Command stacking for similar sequential movements

### 3D Preview
- Real-time 3D visualization of the printing toolpath
- Configurable display options:
  - Show/hide travel moves
  - Toggle build plate grid
  - Toggle axis indicators
- Orbit controls for view manipulation
- Print statistics display

### Editor Features
- Built-in GCode editor with syntax highlighting
- Real-time visualization updates
- Command selection and highlighting
- File import/export capabilities
- Search functionality
- Undo/Redo support

### Performance Features
- Efficient handling of large GCode files
- Batch processing of commands
- Progress indication for large file processing
- Optimized rendering with virtual scrolling
- Debounced updates for smooth performance

## Usage

1. Open the application in a web browser
2. Load a GCode file using the file input
3. Use the view tabs to switch between:
   - 2D Flow view
   - Editor view
   - 3D Preview
4. Interact with the visualization:
   - Click nodes to select commands
   - Use orbit controls in 3D view
   - Toggle visualization options
   - Edit GCode directly in the editor

## Technical Details

### Dependencies
- Three.js for 3D visualization
- OrbitControls for 3D view manipulation

### Browser Support
- Modern browsers with WebGL support
- ES6+ JavaScript support required

### Performance Considerations
- Virtual scrolling for handling large files
- Batch processing for command parsing
- Debounced updates for editor changes
- Efficient DOM manipulation

## Development

### Project Structure
- `index.html` - Main application HTML
- `gcode-visualizer.js` - 2D visualization logic
- `gcode-3d-viewer.js` - 3D visualization implementation

### Key Classes
- `GCodeVisualizer` - Handles 2D visualization and command parsing
- `GCode3DViewer` - Manages 3D visualization and rendering


