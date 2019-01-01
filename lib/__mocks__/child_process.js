module.exports = {
  exec: function(cmd) {
    return {
      cmd,
      on: () => {}
    }
  }
}
