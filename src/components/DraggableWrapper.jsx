import { Component } from './Component.jsx';

/**
 * A higher-order component that adds draggability to any component
 */
export class DraggableWrapper extends Component {
  constructor(props) {
    super(props);
    
    // Default props
    this.handleSelector = props.handleSelector || '';
    this.draggableClass = props.draggableClass || '';
    this.draggingClass = props.draggingClass || 'dragging';
    this.initialLeft = props.initialLeft || '20px';
    this.initialTop = props.initialTop || '20px';
    this.initialRight = props.initialRight;
    
    // Bind methods
    this.makeDraggable = this.makeDraggable.bind(this);
  }
  
  /**
   * Make an element draggable
   * @param {HTMLElement} element - The element to make draggable
   */
  makeDraggable(element) {
    if (!element) {
      console.error('Cannot make null element draggable');
      return;
    }
    
    console.log('Making element draggable:', element);
    
    // Add draggable class if provided
    if (this.draggableClass) {
      element.classList.add(this.draggableClass);
    }
    
    // Get the drag handle
    let handle = element;
    if (this.handleSelector) {
      handle = element.querySelector(this.handleSelector);
      if (!handle) {
        console.warn(`Handle selector "${this.handleSelector}" not found, using element as handle`);
        handle = element;
      }
    }
    
    // Ensure handle has cursor: move
    handle.style.cursor = 'move';
    
    // Set initial position
    element.style.position = 'absolute';
    element.style.top = this.initialTop;
    
    // Set left position (calculated if we have right position)
    if (this.initialRight) {
      element.style.right = this.initialRight;
      // Calculate equivalent left position based on window width
      setTimeout(() => {
        const rect = element.getBoundingClientRect();
        element.style.left = (window.innerWidth - rect.width - parseInt(this.initialRight)) + 'px';
      }, 100);
    } else {
      element.style.left = this.initialLeft;
    }
    
    // Variables for position tracking
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // Define event handlers
    const onMouseDown = (e) => {
      console.log('Mouse down on draggable element');
      e.preventDefault();
      e.stopPropagation();
      
      // Critical: Remove right positioning if it exists
      if (element.style.right) {
        console.log('Removing right positioning for drag');
        element.style.removeProperty('right');
      }
      
      // Record starting mouse position
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Add dragging class
      element.classList.add(this.draggingClass);
      
      // Add document-level event listeners
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
    
    const onMouseMove = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Calculate new cursor position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Calculate new element position
      const newTop = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, element.offsetTop - pos2));
      const newLeft = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, element.offsetLeft - pos1));
      
      // Set new position
      element.style.top = newTop + 'px';
      element.style.left = newLeft + 'px';
    };
    
    const onMouseUp = (e) => {
      console.log('Mouse up - drag complete');
      
      // Remove document-level listeners
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Remove dragging class
      element.classList.remove(this.draggingClass);
    };
    
    // Attach mousedown to handle
    handle.addEventListener('mousedown', onMouseDown);
    
    // Store event listener for cleanup
    this._dragEventHandlers = {
      handle,
      onMouseDown
    };
    
    console.log('Draggable setup complete');
  }
  
  /**
   * Clean up event listeners when unmounting
   */
  componentWillUnmount() {
    // Clean up drag event listeners
    if (this._dragEventHandlers) {
      const { handle, onMouseDown } = this._dragEventHandlers;
      if (handle) {
        handle.removeEventListener('mousedown', onMouseDown);
      }
    }
  }
  
  /**
   * Render the wrapped element and make it draggable
   */
  componentDidMount() {
    // Apply draggability to the rendered element
    if (this.element) {
      this.makeDraggable(this.element);
    }
  }
  
  /**
   * Render the wrapped content
   */
  render() {
    // Simply return the container that will be made draggable
    const container = this.createElement('div', {
      className: 'draggable-wrapper'
    });
    
    // Add children provided by props
    if (this.props.children) {
      if (Array.isArray(this.props.children)) {
        this.props.children.forEach(child => container.appendChild(child));
      } else {
        container.appendChild(this.props.children);
      }
    }
    
    return container;
  }
}