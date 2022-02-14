const moment = require('moment');
const BigNumber = require('bignumber.js');

const PaymentTerm = {
  COD: 1,
  THIRTYDAYS: 2,
  IMMEDIATE: 3,
  SEVENDAYS: 4,
  SIXTYDAYS: 5,
  NINETYDAYS: 6,
};

const SettingTaxDisplay = {
  perItem: 'peritem',
  onTotal: 'ontotal',
};

const SettingTaxType = exports.SettingTaxType = {
  inclusive: 'inclusive',
  exclusive: 'exclusive',
};

const invoiceDueDate = exports.invoiceDueDate = (invoice) => {
  let dueDate;
  if (invoice.paymentTerms === PaymentTerm.COD) {
    dueDate = moment(invoice.deliveryDateEpoch * 1000);
  } else {
    dueDate = moment(invoice.issuedDateEpoch*1000).add(Number(invoice.paymentTermsPeriod), 'days');
  }
  return dueDate;
};

const getPaymentsTotal = exports.getInvoicePaymentsTotal = (payments) => {
  const paymentsBigNumber = payments.reduce(
      (accumulator, payment) => accumulator.plus(new BigNumber(payment.amount)),
      new BigNumber(0),
  );
  return paymentsBigNumber.toNumber();
};

const recalculateTotal = exports.recalculateTotal = (invoice, invoiceItems) => {
  let totalCalc = new BigNumber(0);
  for (const invoiceItem of invoiceItems) {
    const amount = invoiceItem.amount;
    totalCalc = totalCalc.plus(amount);
  }

  if (invoice.settingTaxType === SettingTaxType.exclusive && invoice.settingTaxDisplay === SettingTaxDisplay.onTotal) {
    const taxPercentage = new BigNumber(1).plus(new BigNumber(invoice.settingTaxRate).dividedBy(100));
    totalCalc = totalCalc.multipliedBy(taxPercentage);
  }

  return totalCalc.minus(new BigNumber(invoice.discountAmount)).toNumber();
};

exports.generateNextSequence = (originalString) => {
  const detectedNumbers = originalString.match(/\d+/);
  if (!detectedNumbers) {
    return null;
  }
  const detectedNumber = detectedNumbers[0];
  const currentNumber = Number(detectedNumber);
  if (!isNaN(currentNumber)) {
    const incrementedNumber = currentNumber + 1;
    const originalStringArray = originalString.split('');
    const incrementedArray = incrementedNumber.toString().split('');
    for (let i=0; i<incrementedArray.length; i++) {
      originalStringArray[originalStringArray.length-1-i] = incrementedArray[i];
    }
    return originalStringArray.join('');
  } else {
    return null;
  }
};

exports.calculateDaysOutstanding = (client, invoice) => {
  const paymentsTotal = getPaymentsTotal(invoice.payments);
  const invoiceTotal = recalculateTotal(invoice, invoice.items);
  const balance = new BigNumber(invoiceTotal).minus(new BigNumber(paymentsTotal));
  client.balance = new BigNumber(client.balance).plus(balance).toNumber();
  if (balance.toNumber() !== 0) {
    const dueDate = invoiceDueDate(invoice);
    const todaysDate = moment();
    const thirtyDaysFromDueDate = dueDate.clone().add(30, 'days');
    const sixtyDaysFromDueDate = dueDate.clone().add(60, 'days');
    const ninetyDaysFromDueDate = dueDate.clone().add(90, 'days');
    const hundredAndTwentyDaysFromDueDate = dueDate.clone().add(120, 'days');
    const hundredAndFiftyDaysFromDueDate = dueDate.clone().add(150, 'days');
    if (todaysDate.isAfter(thirtyDaysFromDueDate, 'days') && todaysDate.isSameOrBefore(sixtyDaysFromDueDate, 'days')) {
      client.thirtyDays = new BigNumber(client.thirtyDays).plus(new BigNumber(balance)).toNumber();
    } else if (todaysDate.isAfter(sixtyDaysFromDueDate, 'days') && todaysDate.isSameOrBefore(ninetyDaysFromDueDate, 'days')) {
      client.sixtyDays = new BigNumber(client.sixtyDays).plus(new BigNumber(balance)).toNumber();
    } else if (todaysDate.isAfter(ninetyDaysFromDueDate, 'days') && todaysDate.isSameOrBefore(hundredAndTwentyDaysFromDueDate, 'days')) {
      client.ninetyDays = new BigNumber(client.ninetyDays).plus(new BigNumber(balance)).toNumber();
    } else if (todaysDate.isAfter(hundredAndTwentyDaysFromDueDate, 'days') && todaysDate.isSameOrBefore(hundredAndFiftyDaysFromDueDate, 'days')) {
      client.hundredAndTwentyDays = new BigNumber(client.hundredAndTwentyDays).plus(new BigNumber(balance)).toNumber();
    } else if (todaysDate.isAfter(hundredAndFiftyDaysFromDueDate, 'days')) {
      client.hundredAndFiftyDaysAndAfter = new BigNumber(client.hundredAndFiftyDaysAndAfter).plus(new BigNumber(balance)).toNumber();
    } else {
      client.current = new BigNumber(client.current).plus(new BigNumber(balance)).toNumber();
    }
  }
};

exports.newClientOutstandingDays = (invoice) => {
  return {
    clientAccountNumber: invoice.clientAccountNumber,
    clientName: invoice.clientName,
    balance: 0,
    current: 0,
    thirtyDays: 0,
    sixtyDays: 0,
    ninetyDays: 0,
    hundredAndTwentyDays: 0,
    hundredAndFiftyDaysAndAfter: 0,
  };
};
