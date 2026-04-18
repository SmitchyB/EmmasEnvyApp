// This file is used to compute the checkout breakdown for the POS system
const crypto = require('crypto'); //crypto is used to create a hash of the idempotency key
const { POINTS_PER_DOLLAR } = require('./constants'); //POINTS_PER_DOLLAR is the number of points per dollar

// Function to round the money
function roundMoney(n) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0; //If the amount is not a number or is not finite, then return 0
  return Math.round(n * 100) / 100; //Round the amount to the nearest cent
}

// Function to compute the promo discount
function computePromoDiscount(serviceSubtotal, row) {
  if (!row || serviceSubtotal <= 0) return 0; //If the row is not present or the service subtotal is less than or equal to 0, then return 0
  const dt = String(row.discount_type || '').toLowerCase(); //Set the discount type to the discount type from the row
  const dv = Number(row.discount_value); //Set the discount value to the discount value from the row
  if (Number.isNaN(dv) || dv < 0) return 0; //If the discount value is not a number or is less than 0, then return 0
  //If the discount type is percentage, then compute the promo discount
  if (dt === 'percentage') {
    return roundMoney((serviceSubtotal * dv) / 100); //Compute the promo discount
  }
  //If the discount type is flat amount, then compute the promo discount
  if (dt === 'flat_amount') {
    return roundMoney(Math.min(dv, serviceSubtotal)); //Compute the promo discount
  }
  return 0;
}

// Function to compute the reward discount
function computeRewardDiscount(balanceAfterPromo, row) {
  if (!row || balanceAfterPromo <= 0) return 0; //If the row is not present or the balance after promo is less than or equal to 0, then return 0
  const rt = String(row.reward_type || '').toLowerCase(); //Set the reward type to the reward type from the row
  const val = row.value != null && row.value !== '' ? Number(row.value) : null; //Set the value to the value from the row
  //If the reward type is free service, then compute the reward discount
  if (rt === 'free_service') {
    return roundMoney(balanceAfterPromo); //Compute the reward discount
  }
  //If the reward type is percent off, then compute the reward discount
  if (rt === 'percent_off') {
    if (val == null || Number.isNaN(val) || val <= 0) return 0; //If the value is not a number or is less than or equal to 0, then return 0
    const pct = Math.min(val, 100); //Set the percentage to the minimum of the value and 100
    return roundMoney((balanceAfterPromo * pct) / 100); //Compute the reward discount
  }
  //If the reward type is dollar off, then compute the reward discount
  if (rt === 'dollar_off') {
    if (val == null || Number.isNaN(val) || val <= 0) return 0; //If the value is not a number or is less than or equal to 0, then return 0
    return roundMoney(Math.min(val, balanceAfterPromo)); //Compute the reward discount
  }
  return 0; //If the reward type is not free service, percent off, or dollar off, then return 0
}

// Function to compute the checkout breakdown
function computeCheckoutBreakdown(p) {
  const serviceSubtotal = roundMoney(Number(p.serviceSubtotal) || 0); //Set the service subtotal to the service subtotal from the parameters
  const tip = roundMoney(Math.max(0, Number(p.tip) || 0)); //Set the tip to the tip from the parameters
  const promoDiscount = p.promoRow ? computePromoDiscount(serviceSubtotal, p.promoRow) : 0; //Set the promo discount to the promo discount from the parameters
  const afterPromo = roundMoney(Math.max(0, serviceSubtotal - promoDiscount)); //Set the after promo to the after promo from the parameters
  const rewardDiscount = p.rewardRow ? computeRewardDiscount(afterPromo, p.rewardRow) : 0; //Set the reward discount to the reward discount from the parameters
  const preTipTotal = roundMoney(Math.max(0, afterPromo - rewardDiscount)); //Set the pre tip total to the pre tip total from the parameters
  const grandTotal = roundMoney(preTipTotal + tip); //Set the grand total to the grand total from the parameters
  const pointsToEarn = Math.floor(grandTotal * POINTS_PER_DOLLAR); //Set the points to earn to the points to earn from the parameters
  //Return the checkout breakdown
  return {
    service_subtotal: serviceSubtotal, //Set the service subtotal to the service subtotal
    promo_discount: promoDiscount, //Set the promo discount to the promo discount
    reward_discount: rewardDiscount, //Set the reward discount to the reward discount
    pre_tip_total: preTipTotal, //Set the pre tip total to the pre tip total
    tip, //Set the tip to the tip
    grand_total: grandTotal, //Set the grand total to the grand total
    points_to_earn: pointsToEarn, //Set the points to earn to the points to earn
  };
}

// Function to build the idempotency key
function buildIdempotencyKey(parts) {
  const s = JSON.stringify(parts); //Set the string to the string from the parts
  return crypto.createHash('sha256').update(s).digest('hex'); //Create a hash of the string
}
//Export the functions
module.exports = {
  roundMoney, //roundMoney is the function to round the money
  computePromoDiscount, //computePromoDiscount is the function to compute the promo discount
  computeRewardDiscount, //computeRewardDiscount is the function to compute the reward discount
  computeCheckoutBreakdown, //computeCheckoutBreakdown is the function to compute the checkout breakdown
  buildIdempotencyKey, //buildIdempotencyKey is the function to build the idempotency key
};
