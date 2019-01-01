module.exports = {
  _mockInput: '',
  createInterface: function() {
    const self = this
    return {
      question: function(msg, cb) {
        console.log(msg)
        cb(self._mockInput)
      }
    }
  }
}
