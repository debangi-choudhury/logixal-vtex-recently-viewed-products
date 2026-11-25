const path = require('path')

// A .graphql import becomes its file name, so tests can tell which query or
// mutation a component used.
module.exports = {
  process(_source, filename) {
    return {
      code: `module.exports = ${JSON.stringify(path.basename(filename))}`,
    }
  },
}
