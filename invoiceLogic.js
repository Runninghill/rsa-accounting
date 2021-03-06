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

const exclusiveCalculation = (amountTotal, settingTaxRate, hasTax) => {
    let taxTotal;
    const amountExcludingTax = amountTotal;
    let amountIncludingTax;
    if (hasTax) {
        taxTotal = amountExcludingTax.multipliedBy(settingTaxRate).dividedBy(100);
        amountIncludingTax = amountExcludingTax.plus(taxTotal);
    }else{
        taxTotal = new BigNumber(0);
        amountIncludingTax = amountExcludingTax;
    }

    return {
        amountExcludingTax,
        amountIncludingTax,
        taxTotal
    }
}

const inclusiveCalculation = (amountTotal, taxPercentage, hasTax) => {
    const amountIncludingTax = amountTotal;
    let amountExcludingTax;
    let taxTotal;
    if (hasTax) {
        amountExcludingTax = amountIncludingTax.dividedBy(taxPercentage);
        taxTotal = amountIncludingTax.minus(amountExcludingTax)
    }else{
        amountExcludingTax = amountIncludingTax;
        taxTotal = new BigNumber(0)
    }

    return {
        amountIncludingTax,
        amountExcludingTax,
        taxTotal
    }
}
const calculateLineItemAmounts = exports.calculateLineItemAmounts = (qty, rate, hasTax, settingTaxType, settingTaxRate, discountPercentage) => {
    let taxTotal = new BigNumber(0);
    let taxTotalDiscounted = new BigNumber(0);
    let amountIncludingTax = new BigNumber(0);
    let amountExcludingTax = new BigNumber(0);
    let amountExcludingTaxDiscounted = new BigNumber(0);
    let amountIncludingTaxDiscounted = new BigNumber(0);
    let nonDiscountedAmountTotal = new BigNumber(0);
    let discountedAmountTotal = new BigNumber(0);
    let actualDiscount = new BigNumber(0);

    try {
        nonDiscountedAmountTotal = new BigNumber(rate).multipliedBy(qty);
        discountedAmountTotal = nonDiscountedAmountTotal.minus(nonDiscountedAmountTotal.multipliedBy(discountPercentage).dividedBy(100));

        if (settingTaxType === SettingTaxType.inclusive) {
            const taxPercentage = new BigNumber(1).plus(new BigNumber(settingTaxRate).dividedBy(100));

            const inclusiveResult = inclusiveCalculation(nonDiscountedAmountTotal,taxPercentage,hasTax)
            amountIncludingTax = inclusiveResult.amountIncludingTax;
            amountExcludingTax = inclusiveResult.amountExcludingTax;
            taxTotal = inclusiveResult.taxTotal;

            const inclusiveResultDiscounted = inclusiveCalculation(discountedAmountTotal,taxPercentage,hasTax)
            amountIncludingTaxDiscounted = inclusiveResultDiscounted.amountIncludingTax;
            amountExcludingTaxDiscounted = inclusiveResultDiscounted.amountExcludingTax;
            taxTotalDiscounted = inclusiveResultDiscounted.taxTotal;

            actualDiscount = amountIncludingTax.minus(amountIncludingTaxDiscounted)

        } else {
            const exclusiveNonDiscounted = exclusiveCalculation(nonDiscountedAmountTotal,settingTaxRate,hasTax);
            amountExcludingTax = exclusiveNonDiscounted.amountExcludingTax;
            taxTotal = exclusiveNonDiscounted.taxTotal;
            amountIncludingTax = exclusiveNonDiscounted.amountIncludingTax;

            const exclusiveDiscounted = exclusiveCalculation(discountedAmountTotal,settingTaxRate,hasTax);
            amountExcludingTaxDiscounted = exclusiveDiscounted.amountExcludingTax;
            taxTotalDiscounted = exclusiveDiscounted.taxTotal;
            amountIncludingTaxDiscounted = exclusiveDiscounted.amountIncludingTax;

            actualDiscount = amountExcludingTax.minus(amountExcludingTaxDiscounted)
        }
    } catch (err) {
        console.error(err);
    }

    return {
        amountIncludingTaxDiscounted:amountIncludingTaxDiscounted.toNumber(),
        amountExcludingTaxDiscounted:amountExcludingTaxDiscounted.toNumber(),
        taxDiscounted:taxTotalDiscounted.toNumber(),
        amountExcludingTax: amountExcludingTax.toNumber().toFixed(2),
        amountIncludingTax: amountIncludingTax.toNumber().toFixed(2),
        tax: taxTotal.toNumber().toFixed(2),
        actualDiscount:actualDiscount.toNumber()
    }
}

const discountPercentageFromAmount = exports.discountPercentageFromAmount = (invoiceItems,discountAmount) => {
    const taxInclusiveTotal = invoiceItems.reduce((previousValue,currentValue)=>
                previousValue.plus(new BigNumber(currentValue.quantity).multipliedBy(new BigNumber(currentValue.rate))),
            new BigNumber(0))
    return new BigNumber(100).dividedBy(taxInclusiveTotal.dividedBy(discountAmount)).toNumber();
}

const calculateTotals = exports.calculateTotals = (invoiceItems, taxRate, settingTaxType, discountPercentage,discountAmount) => {
    let actualDiscountAmount = new BigNumber(0);
    let taxTotal =  new BigNumber(0);
    let subTotalAmount =  new BigNumber(0);
    if (discountAmount){
        discountPercentage = discountPercentageFromAmount(invoiceItems,discountAmount);
    }
    if (!discountAmount && !discountPercentage){
        discountPercentage = 0;
    }
    for (let invoiceItem of invoiceItems) {
        const {amountExcludingTaxDiscounted,taxDiscounted,actualDiscount} = calculateLineItemAmounts(invoiceItem.quantity,invoiceItem.rate,invoiceItem.hasTax,settingTaxType,taxRate, discountPercentage);
        subTotalAmount = subTotalAmount.plus(amountExcludingTaxDiscounted);
        taxTotal = new BigNumber(taxTotal).plus(taxDiscounted);
        actualDiscountAmount = new BigNumber(actualDiscountAmount).plus(actualDiscount);
    }
    let subTotal = subTotalAmount.toNumber();
    const taxAmount = taxTotal.toNumber();
    const total = new BigNumber(subTotal).plus(taxAmount).toNumber();

    return {
        taxAmount,
        subTotal,
        discountAmount : actualDiscountAmount ? actualDiscountAmount.toNumber() : null,
        total
    }
}

exports.checkIfInvoiceOverdue = (invoice, paymentsTotal) => {
    // TODO MVW think about using the users current timezone to calculate todays date
    const todaysDate = moment();
    const dueDate = invoiceDueDate(invoice);
    const totals = calculateTotals(invoice.items, invoice.settingTaxRate, invoice.settingTaxType, invoice.discountPercentage, invoice.discountAmount);
    const invoiceTotal = totals.total;
    const isPartiallyPaid = paymentsTotal < invoiceTotal;
    return todaysDate.isAfter(dueDate, 'days') && isPartiallyPaid;
};

const getPaymentsTotal = exports.getInvoicePaymentsTotal = (payments) => {
    const paymentsBigNumber = payments.reduce(
        (accumulator, payment) => accumulator.plus(new BigNumber(payment.amount)),
        new BigNumber(0),
    );
    return paymentsBigNumber.toNumber();
};


exports.ageAnalysis = (transactions) => {
    const ageAnalysis = {
        balance: 0,
        current: 0,
        thirtyDays: 0,
        sixtyDays: 0,
        ninetyDays: 0,
        hundredAndTwentyDays: 0,
        hundredAndFiftyDaysAndAfter: 0,
    };

    for (const transaction of transactions){
        const totals = transaction.isQuote ? {total:0} : calculateTotals(transaction.items, transaction.settingTaxRate, transaction.settingTaxType, transaction.discountPercentage, transaction.discountAmount);
        const paymentsTotal = getPaymentsTotal(transaction.payments);
        const transactionTotal = totals.total;
        const balance = new BigNumber(transactionTotal).minus(new BigNumber(paymentsTotal));
        ageAnalysis.balance = new BigNumber(ageAnalysis.balance).plus(balance).toNumber();
        if (balance.toNumber() !== 0) {
            const documentDate = moment(transaction.issuedDateEpoch * 1000);
            //TODO dont use invoiceDueDate calc, use documentDate as is
            const dueDate = documentDate;
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

    }

    return ageAnalysis;
};
