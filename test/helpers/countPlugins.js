/**
 * @param {object} root0 options
 * @param {import("tapable").Hook[]} root0.hooks hooks
 * @param {string=} pluginName plugin name filter
 * @returns {number} count of plugins
 */
export default function countPlugins({ hooks }, pluginName) {
  return Object.keys(hooks).reduce((aggregate, name) => {
    const taps = Array.isArray(hooks[name].taps) ? hooks[name].taps : [];
    const count = pluginName
      ? taps.filter((tap) => tap.name === pluginName).length
      : taps.length;

    if (!pluginName || count > 0) {
      aggregate[name] = count;
    }

    return aggregate;
  }, {});
}
