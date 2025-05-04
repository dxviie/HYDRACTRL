import { Component } from './Component.jsx';
import { DraggableWrapper } from './DraggableWrapper.jsx';

/**
 * Performance Monitor Panel component
 * Displays FPS and other performance metrics
 */
export class MonitorPanel extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      fps: 0,
      averageFps: 0,
      isExpanded: false,
      frameCount: 0,
      totalFrameTime: 0,
      memoryUsage: 0,
      lastFrameTime: performance.now()
    };
    
    // Bind methods
    this.toggleExpand = this.toggleExpand.bind(this);
    this.update = this.update.bind(this);
    this.makeElementDraggable = this.makeElementDraggable.bind(this);
  }
  
  /**
   * Toggle expanded state of monitor panel
   */
  toggleExpand() {
    this.setState({
      isExpanded: !this.state.isExpanded
    });
  }
  
  // Removed old makeDraggable method - using DraggableWrapper now
  
  /**
   * Update performance metrics
   */
  update() {
    const now = performance.now();
    const frameTime = now - this.state.lastFrameTime;
    const currentFps = frameTime > 0 ? 1000 / frameTime : 0;
    
    // Update running average (ensure we don't divide by zero)
    const newFrameCount = this.state.frameCount + 1;
    const newTotalFrameTime = this.state.totalFrameTime + frameTime;
    const newAverageFps = newTotalFrameTime > 0 ? 1000 / (newTotalFrameTime / newFrameCount) : 0;
    
    // Get memory usage if available
    let memoryUsage = 0;
    if (window.performance && performance.memory) {
      memoryUsage = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
    }
    
    this.setState({
      fps: Math.round(currentFps),
      averageFps: Math.round(newAverageFps * 10) / 10,
      frameCount: newFrameCount,
      totalFrameTime: newTotalFrameTime,
      lastFrameTime: now,
      memoryUsage
    });
    
    // Request next frame and store the ID
    this._frameId = requestAnimationFrame(this.update);
  }
  
  /**
   * Component lifecycle method
   * Start update loop when component mounts
   */
  componentDidMount() {
    // Initialize the panel
    const panel = this.element;
    
    console.log('MonitorPanel mounted, element:', panel);
    
    // Use direct method instead of wrapper component for now
    this.makeElementDraggable(panel);
    
    // Set lastFrameTime to current time to begin accurate FPS tracking
    this.state.lastFrameTime = performance.now();
    
    // Start performance monitoring loop
    this._frameId = requestAnimationFrame(this.update);
  }
  
  /**
   * Simple direct draggable implementation
   */
  makeElementDraggable(element) {
    // Find the handle
    const handle = element.querySelector('.monitor-handle');
    if (!handle) {
      console.error('No drag handle found');
      return;
    }
    
    console.log('Setting up draggable panel with handle:', handle);
    
    // Set cursor style
    handle.style.cursor = 'move';
    
    // Set position
    element.style.position = 'absolute';
    element.style.top = '20px';
    element.style.right = '20px';
    
    // Force left position calculation based on right position
    setTimeout(() => {
      // Get the initial rect
      const rect = element.getBoundingClientRect();
      console.log('Initial rect:', rect);
      
      // Calculate and set left position
      const leftPos = window.innerWidth - rect.width - 20;
      element.style.left = leftPos + 'px';
      console.log('Set initial left position:', leftPos);
    }, 100);
    
    // Variables to track position
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // Mouse down handler
    const mouseDownHandler = (e) => {
      console.log('Mouse down on handle!', e);
      e.preventDefault();
      e.stopPropagation();
      
      // Remove right positioning
      if (element.style.right) {
        console.log('Removing right property');
        element.style.right = '';
      }
      
      // Get initial mouse position
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Add document listeners
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
      
      // Add dragging class
      element.classList.add('monitor-dragging');
    };
    
    // Mouse move handler
    const mouseMoveHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Calculate position change
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Set new position
      const newTop = element.offsetTop - pos2;
      const newLeft = element.offsetLeft - pos1;
      
      element.style.top = newTop + 'px';
      element.style.left = newLeft + 'px';
      
      // Debug position
      if (pos1 !== 0 || pos2 !== 0) {
        console.log('Moving panel to:', newLeft, newTop);
      }
    };
    
    // Mouse up handler
    const mouseUpHandler = (e) => {
      console.log('Mouse up - drag complete');
      
      // Remove document listeners
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      
      // Remove dragging class
      element.classList.remove('monitor-dragging');
    };
    
    console.log('Adding mousedown listener to handle');
    
    // Add initial event listener using direct DOM method
    handle.onmousedown = mouseDownHandler;
    
    // Also add using addEventListener for good measure
    handle.addEventListener('mousedown', mouseDownHandler);
    
    // Store handlers for cleanup
    this._dragHandlers = {
      mouseDown: mouseDownHandler,
      handle
    };
    
    // Try touching the DOM to ensure events are attached
    handle.style.cursor = 'move';
    handle.style.cursor = 'grab';
    
    console.log('Draggable setup complete');
  }
  
  /**
   * Component lifecycle method
   * Clean up when component unmounts
   */
  componentWillUnmount() {
    // Cancel animation frame to prevent memory leaks
    if (this._frameId) {
      cancelAnimationFrame(this._frameId);
    }
    
    // Clean up drag handlers
    if (this._dragHandlers) {
      const { handle, mouseDown } = this._dragHandlers;
      if (handle && mouseDown) {
        // Remove both event listeners
        handle.removeEventListener('mousedown', mouseDown);
        handle.onmousedown = null;
      }
    }
  }
  
  // Removed duplicate componentWillUnmount
  
  /**
   * Render component
   * @returns {HTMLElement}
   */
  render() {
    const { fps, averageFps, isExpanded, memoryUsage, frameCount } = this.state;
    
    const colorClass = fps > 50 ? 'monitor-value-good' : 
                       fps > 30 ? 'monitor-value-warning' : 'monitor-value-bad';
    
    // Create container
    const container = this.createElement('div', { 
      className: `monitor-panel ${isExpanded ? 'monitor-expanded' : 'monitor-collapsed'}`
    });
    
    // Create handle
    const handle = this.createElement('div', { className: 'monitor-handle' },
      this.createElement('div', { className: 'monitor-title' }, 'STATS'),
      this.createElement('div', { 
        className: 'monitor-toggle',
        onClick: this.toggleExpand
      }, isExpanded ? '▼' : '▲')
    );
    
    // Create content container
    const content = this.createElement('div', { className: 'monitor-content' });
    
    // Create main metrics (always visible)
    const mainMetrics = this.createElement('div', { className: 'monitor-main-metrics' });
    
    // Add FPS metric
    const fpsMetric = this.createElement('div', { className: 'monitor-metric' },
      this.createElement('span', { className: 'monitor-label' }, 'FPS:'),
      this.createElement('span', { className: `monitor-value ${colorClass}` }, String(fps || 0))
    );
    mainMetrics.appendChild(fpsMetric);
    
    // Add detailed metrics if expanded
    if (isExpanded) {
      const details = this.createElement('div', { className: 'monitor-details' });
      
      // Add average FPS
      const avgFpsMetric = this.createElement('div', { className: 'monitor-metric' },
        this.createElement('span', { className: 'monitor-label' }, 'AVG FPS:'),
        this.createElement('span', { className: 'monitor-value' }, String(averageFps || 0))
      );
      details.appendChild(avgFpsMetric);
      
      // Add memory usage if available
      if (memoryUsage > 0) {
        const memoryMetric = this.createElement('div', { className: 'monitor-metric' },
          this.createElement('span', { className: 'monitor-label' }, 'MEMORY:'),
          this.createElement('span', { className: 'monitor-value' }, `${memoryUsage} MB`)
        );
        details.appendChild(memoryMetric);
      }
      
      // Add frame count
      const frameCountMetric = this.createElement('div', { className: 'monitor-metric' },
        this.createElement('span', { className: 'monitor-label' }, 'FRAMES:'),
        this.createElement('span', { className: 'monitor-value' }, String(frameCount || 0))
      );
      details.appendChild(frameCountMetric);
      
      content.appendChild(details);
    }
    
    // Assemble the component
    content.insertBefore(mainMetrics, content.firstChild);
    container.appendChild(handle);
    container.appendChild(content);
    
    return container;
  }
}