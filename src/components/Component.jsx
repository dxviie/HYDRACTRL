/**
 * Base Component class for HYDRACTRL
 * All UI components should extend this class
 */
export class Component {
  constructor(props) {
    this.props = props || {};
    this.state = {};
    this.element = null;
  }
  
  /**
   * Update component state and trigger re-render
   * @param {Object} newState - New state to merge with existing state
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    if (this.element && this.container) {
      const newElement = this.render();
      this.container.replaceChild(newElement, this.element);
      this.element = newElement;
    }
  }
  
  /**
   * Mount component to DOM
   * @param {HTMLElement} container - Element to mount component in
   */
  mount(container) {
    if (!container) return;
    this.container = container;
    
    // Create the element if it doesn't exist
    if (!this.element) {
      this.element = this.render();
      container.appendChild(this.element);
    } else {
      // Replace existing element
      const newElement = this.render();
      container.replaceChild(newElement, this.element);
      this.element = newElement;
    }
    
    // Run componentDidMount lifecycle method if available
    if (this.componentDidMount) {
      this.componentDidMount();
    }
    
    return this.element;
  }
  
  /**
   * Unmount component from DOM
   */
  unmount() {
    if (this.element && this.element.parentNode) {
      // Run componentWillUnmount lifecycle method if available
      if (this.componentWillUnmount) {
        this.componentWillUnmount();
      }
      
      this.element.parentNode.removeChild(this.element);
    }
  }
  
  /**
   * Create HTML element from JSX-like structure
   * @param {string} tag - HTML tag name
   * @param {Object} attrs - Element attributes
   * @param {Array} children - Child elements
   * @returns {HTMLElement}
   */
  createElement(tag, attrs, ...children) {
    // Create the element
    const element = document.createElement(tag);
    
    // Set attributes
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
          element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
          Object.entries(value).forEach(([cssKey, cssValue]) => {
            // Convert camelCase to kebab-case
            const kebabKey = cssKey.replace(/([A-Z])/g, '-$1').toLowerCase();
            element.style[cssKey] = cssValue;
          });
        } else if (key.startsWith('on') && typeof value === 'function') {
          const eventName = key.slice(2).toLowerCase();
          element.addEventListener(eventName, value);
        } else {
          element.setAttribute(key, value);
        }
      });
    }
    
    // Add children
    children.flat().forEach(child => {
      if (child instanceof Element) {
        element.appendChild(child);
      } else if (child instanceof Component) {
        child.mount(element);
      } else if (child !== null && child !== undefined) {
        element.appendChild(document.createTextNode(child.toString()));
      }
    });
    
    return element;
  }
  
  /**
   * Render component
   * Must be implemented by subclasses
   * @returns {HTMLElement}
   */
  render() {
    throw new Error('Component must implement render() method');
  }
}