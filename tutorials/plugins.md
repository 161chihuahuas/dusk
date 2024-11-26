Dusk plugins are a simple way to package additional features. A plugin is just 
a function that receives an instance of {@link KademliaNode}. This function can 
then apply any decorations desired.

### Included Plugins

* {@link module:dusk/eclipse~EclipsePlugin}
* {@link module:dusk/hashcash~HashCashPlugin}
* {@link module:dusk/hibernate~HibernatePlugin}
* {@link module:dusk/onion~OnionPlugin}
* {@link module:dusk/permission~PermissionPlugin}
* {@link module:dusk/quasar~QuasarPlugin}
* {@link module:dusk/rolodex~RolodexPlugin}
* {@link module:dusk/spartacus~SpartacusPlugin}
* {@link module:dusk/traverse~TraversePlugin}

### Example: "Howdy, Neighbor" Plugin

```js
/**
 * Example "howdy, neighbor" plugin
 * @function
 * @param {KademliaNode} node
 */
module.exports = function(node) {

  const { identity } = node;

  /**
   * Respond to HOWDY messages
   */
  node.use('HOWDY', (req, res) => {
    res.send(['howdy, neighbor']);
  });

  /**
   * Say howdy to our nearest neighbor
   */
  node.sayHowdy = function(callback) {
    let neighbor = [
      ...node.router.getClosestContactsToKey(identity).entries()
    ].shift();
    
    node.send('HOWDY', ['howdy, neighbor'], neighbor, callback);
  };

};
```


