const invoiceLogic = require('./invoiceLogic');

module.exports = {getAgeAnalysis:invoiceLogic.calculateDaysOutstanding};
