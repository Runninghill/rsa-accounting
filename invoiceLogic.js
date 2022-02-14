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
    dueDate = moment(invoice.issuedDateEpoch * 1000).add(Number(invoice.paymentTermsPeriod), 'days');
  }
  return dueDate;
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
    for (let i = 0; i < incrementedArray.length; i++) {
      originalStringArray[originalStringArray.length - 1 - i] = incrementedArray[i];
    }
    return originalStringArray.join('');
  } else {
    return null;
  }
};

const calculateAmountAndTax = (settingTaxType, invoiceLineItem, settingTaxRate, isCreditInvoice) => {
  let taxTotal = new BigNumber(0);
  let amountTotal = new BigNumber(0);
  let amountTotalExclCalcs = new BigNumber(0);
  const lineItemRate = invoiceLineItem.rate;
  const lineItemQuantity = invoiceLineItem.quantity;
  const lineItemHasTax = invoiceLineItem.hasTax;
  if (lineItemQuantity && lineItemRate) {
    try {
      const rate = Number(lineItemRate);
      const qty = Number(lineItemQuantity);
      amountTotalExclCalcs = new BigNumber(rate).multipliedBy(qty);

      if (settingTaxType === SettingTaxType.inclusive) {
        const taxPercentage = new BigNumber(1).plus(new BigNumber(settingTaxRate).dividedBy(100));
        const amountBeforeTax  = amountTotalExclCalcs.dividedBy(taxPercentage);
        if (lineItemHasTax){
          taxTotal = amountTotalExclCalcs.minus(amountBeforeTax);
        }
        amountTotal = amountTotalExclCalcs;
      }else{
        if (lineItemHasTax){
          taxTotal = amountTotalExclCalcs.multipliedBy(new BigNumber(settingTaxRate).dividedBy(100));
        }
        amountTotal = amountTotalExclCalcs.plus(taxTotal);
      }
    } catch (err) {
    }
  }

  return {
    amountTotal:(isCreditInvoice ? -amountTotal.toNumber() : amountTotal.toNumber()),
    tax:taxTotal.toNumber()
  }
}

const getInvoiceSubTotal = exports.getInvoiceSubTotal = (invoiceItems, taxRate, settingTaxType, isDiscountPercentage, discountPercentage, isCreditInvoice) => {
  let discountAmount = 0;
  let subTotal = 0;
  let amountTotal = 0;
  let taxTotal = 0;
  for (let invoiceItem of invoiceItems) {
    const amountAndTax = calculateAmountAndTax(settingTaxType, invoiceItem, taxRate, isCreditInvoice);
    amountTotal = new BigNumber(amountTotal).plus(amountAndTax.amountTotal).minus(amountAndTax.tax).toNumber();
    taxTotal = new BigNumber(amountTotal).plus(amountAndTax.tax).toNumber();
  }

  if (isDiscountPercentage) {
    discountAmount = new BigNumber(settingTaxType === SettingTaxType.exclusive ? amountTotal : taxTotal).multipliedBy(discountPercentage).dividedBy(100).toNumber();
  }

  if (settingTaxType === SettingTaxType.exclusive){
    subTotal = new BigNumber(amountTotal).minus(discountAmount).toNumber();
  }else{
    const taxPercentage = new BigNumber(1).plus(new BigNumber(taxRate).dividedBy(100));
    subTotal = (new BigNumber(taxTotal).minus(discountAmount)).dividedBy(taxPercentage).toNumber();
  }
  return subTotal;
}

const getInvoiceTotal = exports.getInvoiceTotal = (subTotal, taxRate) => {
  const taxPercentage = new BigNumber(1).plus(new BigNumber(taxRate).dividedBy(100));
  return new BigNumber(subTotal).multipliedBy(taxPercentage).toNumber();
}


const getPaymentsTotal = exports.getInvoicePaymentsTotal = (payments) => {
  const paymentsBigNumber = payments.reduce(
    (accumulator, payment) => accumulator.plus(new BigNumber(payment.amount)),
    new BigNumber(0),
  );
  return paymentsBigNumber.toNumber();
};


exports.ageAnalysis = (clientBalance, invoice) => {
  const ageAnalysis = {
      balance: 0,
      current: 0,
      thirtyDays: 0,
      sixtyDays: 0,
      ninetyDays: 0,
      hundredAndTwentyDays: 0,
      hundredAndFiftyDaysAndAfter: 0,
  };
  const invoiceSubTotal = getInvoiceSubTotal(invoice.items, invoice.settingTaxRate, invoice.settingTaxType, invoice.isDiscountPercentage, invoice.discountPercentage, invoice.isCreditInvoice);
  const paymentsTotal = getPaymentsTotal(invoice.payments);
  const invoiceTotal = getInvoiceTotal(invoiceSubTotal, invoice.settingTaxRate);
  const balance = new BigNumber(invoiceTotal).minus(new BigNumber(paymentsTotal));
  ageAnalysis.balance = new BigNumber(clientBalance).plus(balance).toNumber();
  if (balance.toNumber() !== 0) {
    const dueDate = invoiceDueDate(invoice);
    const todaysDate = moment();
    const thirtyDaysFromDueDate = dueDate.clone().add(30, 'days');
    const sixtyDaysFromDueDate = dueDate.clone().add(60, 'days');
    const ninetyDaysFromDueDate = dueDate.clone().add(90, 'days');
    const hundredAndTwentyDaysFromDueDate = dueDate.clone().add(120, 'days');
    const hundredAndFiftyDaysFromDueDate = dueDate.clone().add(150, 'days');
    if (todaysDate.isAfter(thirtyDaysFromDueDate, 'days') && todaysDate.isSameOrBefore(sixtyDaysFromDueDate, 'days')) {
      ageAnalysis.thirtyDays = new BigNumber(ageAnalysis.thirtyDays).plus(new BigNumber(balance)).toNumber();
    } else if (todaysDate.isAfter(sixtyDaysFromDueDate, 'days') && todaysDate.isSameOrBefore(ninetyDaysFromDueDate, 'days')) {
      ageAnalysis.sixtyDays = new BigNumber(ageAnalysis.sixtyDays).plus(new BigNumber(balance)).toNumber();
    } else if (todaysDate.isAfter(ninetyDaysFromDueDate, 'days') && todaysDate.isSameOrBefore(hundredAndTwentyDaysFromDueDate, 'days')) {
      ageAnalysis.ninetyDays = new BigNumber(ageAnalysis.ninetyDays).plus(new BigNumber(balance)).toNumber();
    } else if (todaysDate.isAfter(hundredAndTwentyDaysFromDueDate, 'days') && todaysDate.isSameOrBefore(hundredAndFiftyDaysFromDueDate, 'days')) {
      ageAnalysis.hundredAndTwentyDays = new BigNumber(ageAnalysis.hundredAndTwentyDays).plus(new BigNumber(balance)).toNumber();
    } else if (todaysDate.isAfter(hundredAndFiftyDaysFromDueDate, 'days')) {
      ageAnalysis.hundredAndFiftyDaysAndAfter = new BigNumber(ageAnalysis.hundredAndFiftyDaysAndAfter).plus(new BigNumber(balance)).toNumber();
    } else {
      ageAnalysis.current = new BigNumber(ageAnalysis.current).plus(new BigNumber(balance)).toNumber();
    }
  }

  return ageAnalysis;
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
