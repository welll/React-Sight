//might need additional testing..renderers provides a list of all imported React instances
console.log(window)
const reactInstances = window.__REACT_DEVTOOLS_GLOBAL_HOOK__._renderers || null;
//grab the first instance of imported React library
const instance = reactInstances[Object.keys(reactInstances)[0]];
var throttle = false;
var store;
// var store = [];
//locate instance of __REACT_DEVTOOLS_GLOBAL_HOOK__
//__REACT_DEVTOOLS_GLOBAL_HOOK__ exists if React is imported in inspected Window
(function installHook() {
  //no instance of React
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    //should run loading animation here probably
    return console.log('Cannot find React library...')
  } else {
    console.log('instance: ', instance)
    //hijack receiveComponent method which runs after a component is rendered
    instance.Reconciler.receiveComponent = (function (original) {
      return function (...args) {
        if (!throttle) {
          throttle = true
          setTimeout(() => {
            getData();
            throttle = false
          }, 10)
        }
        return original(...args)
      }
    })(instance.Reconciler.receiveComponent)
  }
})();

const getData = (components = []) => {
  //define rootElement of virtual DOM
  const rootElement = instance.Mount._instancesByReactRootID[1]._renderedComponent;
  console.log('rootElement: ', rootElement)
  //recursively traverse down through props chain   starting from root element
  traverseAllChildren(rootElement, components);
  const data = { data: components, store: store }
  console.log('retrieved data --> posting to content-scripts...: ', data)
  window.postMessage(JSON.parse(JSON.stringify(data)), '*');
};

const traverseAllChildren = (component, parentArr) => {
  // if no current element, return
  if (!component._currentElement) return

  // console.log('current component: ', component)

  const newComponent = {
    children: [],
    id: null,
    name: 'default',
    state: null,
    props: null,
    ref: null,
    key: null,
  };

  // Get ID -> DO NOT REMOVE
  if (component._debugID) {
    newComponent.id = component._debugID
  }
  else if (component._domID) {
    newComponent.id = component._domID
    newComponent.isDOM = true;
  }
  else {
    newComponent.id = component._mountOrder * 100
    newComponent.isDOM = false;
  }

  // Get Name
  if (component._currentElement.type) {
    // check for displayName or name
    if (component._currentElement.type.displayName) newComponent.name = component._currentElement.type.displayName
    else if (component._currentElement.type.name) newComponent.name = component._currentElement.type.name
    else newComponent.name = component._currentElement.type
  } else newComponent.name = 'default'

  //call getState() on react-redux.connect()
  if (component._currentElement.type) {
    if (component._currentElement.type.propTypes) {
      if (component._currentElement.type.propTypes.hasOwnProperty('store')) {
        store = component._instance.store.getState()
      }
    }
  }

  // Get State
  if (!newComponent.state && component._instance && component._instance.state) {
    newComponent.state = component._instance.state
    if (newComponent.state && Object.keys(newComponent.state).length === 0) {
      newComponent.state = null;
    }
  }
  if (!newComponent.props && component._currentElement && component._currentElement.props) {
    newComponent.props = parseProps(component._currentElement.props)
  }
  //Get key
  if (!newComponent.key && component._currentElement && component._currentElement.key) {
    newComponent.key = component._currentElement.key
  }
  if (!newComponent.ref && component._currentElement && component._currentElement.ref) {
    newComponent.ref = component._currentElement.ref
  }

  //go into children of current component
  const componentChildren = component._renderedChildren
  parentArr.push(newComponent);
  if (componentChildren) {
    const keys = Object.keys(componentChildren)
    keys.forEach(key => {
      traverseAllChildren(componentChildren[key], newComponent.children)
    })
  }
  else if (component._renderedComponent) {
    traverseAllChildren(component._renderedComponent, newComponent.children)
  }
}

const parseProps = (props) => {
  if (!props) return;
  if (typeof props !== 'object') return props
  //check if current props has PROPS property..don't traverse further just grab name property
  if (props.hasOwnProperty('props')) {
    if (!props.hasOwnProperty('type')) return;
    else if (props.type.hasOwnProperty('name') && props.type.name.length) return props.type.name
    else if (props.type.hasOwnProperty('displayName') && props.type.displayName.length) return props.type.displayName
    else if (props.hasOwnProperty('type')) return '' + props.type
  } else {
    let parsedProps = {};
    for (let key in props) {
      if (!props[key]) parsedProps[key] === null
      //stringify methods
      else if (key === 'routes') {
      } else if (typeof props[key] === 'function') {
        parsedProps[key] = '' + props[key]
      } else if (Array.isArray(props[key]) && key === 'children') {
        //parseProps forEach element
        parsedProps[key] = [];
        props[key].forEach(child => {
          parsedProps[key].push(parseProps(child))
        })
      } else if (typeof props[key] === 'object') {
        //handle custom objects and components with one child
        if (props[key] && Object.keys(props[key]).length) {
          parsedProps[key] = parseProps(props[key])
        }
      } else {
        //handle text nodes and other random values
        parsedProps[key] = props[key]
      }
    }
    return parsedProps
  }
}

//listener for initial load
window.addEventListener('reactsight', e => {
  getData()
})
