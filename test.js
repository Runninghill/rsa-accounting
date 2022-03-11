const invoiceLogic = require('./invoiceLogic');

// const result = invoiceLogic.calculateLineItemAmounts(1,1000,false,'exclusive',15,false,10,null);
// const result2 = invoiceLogic.calculateLineItemAmounts(10,1000,true,'exclusive',15,false,null,10);
const result = invoiceLogic.calculateTotals([
    {
        "id": 420,
        "reference": "",
        "description": "Doopddop",
        "quantity": 1,
        "unit": "Unit",
        "rate": 200,
        "hasTax": false,
        "date": "",
        "detailedDescription": null,
        "amount": "230.00"
    },
    // {
    //     "id": 421,
    //     "reference": "",
    //     "description": "Doopddop",
    //     "quantity": 10,
    //     "unit": "Unit",
    //     "rate": 1000,
    //     "hasTax": true,
    //     "date": "",
    //     "detailedDescription": null,
    //     "amount": "230.00"
    // }
],15,'exclusive',false,10,false,0);
console.log(result);
// console.log(result2);
