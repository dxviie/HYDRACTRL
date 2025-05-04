import { Component } from './Component.jsx';

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
    this.makeDraggable = this.makeDraggable.bind(this);
  }
  
  /**
   * Toggle expanded state of monitor panel
   */
  toggleExpand() {
    this.setState({
      isExpanded: !this.state.isExpanded
    });
  }
  
  /**
   * Make the panel draggable
   * @param {HTMLElement} element - Element to make draggable
   * @param {HTMLElement} handle - Drag handle element
   */
  makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    if (handle) {
      // If handle is specified, use it for dragging
      handle.onmousedown = dragMouseDown;
    } else {
      // Otherwise, use the entire element
      element.onmousedown = dragMouseDown;
    }

    const that = this;
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // Get the mouse cursor position at startup
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // Call function whenever the cursor moves
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // Calculate new cursor position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // Set the element's new position
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      // Stop moving when mouse button is released
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
  
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
    // Make panel draggable
    const panel = this.element;
    const handle = panel.querySelector('.monitor-handle');
    this.makeDraggable(panel, handle);
    
    // Set lastFrameTime to current time to begin accurate FPS tracking
    this.state.lastFrameTime = performance.now();
    
    // Start performance monitoring loop
    this._frameId = requestAnimationFrame(this.update);
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