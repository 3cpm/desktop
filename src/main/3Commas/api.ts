import threeCommasAPI from './3commaslib';
import log from 'electron-log';
import { Type_MarketOrders } from '@/types/3Commas'
import { Bots } from './types/Bots'
import { setProfileConfig } from '@/main/Config/config';

import {
  calc_dealHours,
  calc_DealMaxFunds_bot,
  calc_deviation,
  calc_maxBotFunds,
  calc_maxDealFunds_Deals,
  calc_maxInactiveFunds
} from '@/utils/formulas';

import { Type_Profile } from "@/types/config";
import { threeCommas_Api_Deals, UpdateDealRequest } from './types/Deals';



/**
 * 
 * @param {object} config This is the config string at the time of calling this function.
 * @returns the 3Commas API object.
 * 
 * @description - required at the moment so when you make a config change on the frontend you're not using old data.
 */
const threeCapi = (profileData?: Type_Profile, apiKey?: string, apiSecret?: string, mode?: string): threeCommasAPI | false => {

  if (!apiKey || !apiSecret || !mode) {
    if (!profileData) return false
    apiKey = profileData.apis.threeC.key
    apiSecret = profileData.apis.threeC.secret
    mode = profileData.apis.threeC.mode
  }

  if (apiKey == null || apiSecret == null || mode == null) {
    log.error('missing API keys or mode')
    return false
  }

  return new threeCommasAPI({ apiKey, apiSecret, mode, })
}


async function bots(profileData: Type_Profile) {
  const api = threeCapi(profileData)
  if (!api) return [];

  let responseArray = [];
  let response: Bots[];
  let offsetMax = 5000;
  let perOffset = 100;

  for (let offset = 0; offset < offsetMax; offset += perOffset) {
    response = await api.getBots({ limit: 100, sort_by: 'updated_at', sort_direction: 'desc', offset });
    if (response.length > 0) { responseArray.push(...response) }
    if (response.length != perOffset) break
  }

  return responseArray.map(bot => {
    let {
      id, account_id, account_name, is_enabled,
      max_safety_orders, active_safety_orders_count,
      max_active_deals, active_deals_count,
      name, take_profit, take_profit_type, created_at, updated_at,
      base_order_volume, safety_order_volume, base_order_volume_type,
      safety_order_step_percentage, type,
      martingale_volume_coefficient, martingale_step_coefficient,
      safety_order_volume_type,
      profit_currency, finished_deals_profit_usd,
      finished_deals_count, pairs, trailing_deviation,
      active_deals_usd_profit, stop_loss_percentage,
      strategy
    } = bot

    const maxDealFunds = calc_DealMaxFunds_bot(max_safety_orders, +base_order_volume, +safety_order_volume, +martingale_volume_coefficient)
    const max_inactive_funds = calc_maxInactiveFunds(maxDealFunds, max_active_deals, active_deals_count)

    return {
      id,
      origin: 'sync',
      account_id,
      account_name,
      name,
      pairs: pairs.map(p => p.split('_')[1]).join(),
      active_deals_count,
      active_deals_usd_profit,
      active_safety_orders_count,
      base_order_volume,
      base_order_volume_type,
      created_at,
      updated_at,
      'enabled_inactive_funds': (is_enabled == true) ? +max_inactive_funds : 0,
      'enabled_active_funds': (is_enabled == true) ? +maxDealFunds * active_deals_count : 0,
      finished_deals_count,
      finished_deals_profit_usd,
      is_enabled,
      martingale_volume_coefficient,
      martingale_step_coefficient,
      max_active_deals,
      'max_funds': calc_maxBotFunds(maxDealFunds, max_active_deals),
      'max_funds_per_deal': maxDealFunds,
      max_inactive_funds,
      max_safety_orders,
      from_currency: pairs[0].split('_')[0],
      profit_currency,
      safety_order_step_percentage,
      safety_order_volume,
      safety_order_volume_type,
      stop_loss_percentage,
      strategy,
      take_profit,
      take_profit_type,
      trailing_deviation,
      type: type.split('::')[1],
      drawdown: 0,
      price_deviation: calc_deviation(+max_safety_orders, +safety_order_step_percentage, +martingale_step_coefficient),
      maxCoveragePercent: null
    }
  })
}

/**
   * @param {number} deal_id The deal id of an active deal
   * 
   * @description Fetching market orders for bots that are active and have active market orders
   * @api_docs - https://github.com/3commas-io/3commas-official-api-docs/blob/master/deals_api.md#deal-safety-orders-permission-bots_read-security-signed
   */
async function getMarketOrders(deal_id: number, profileData: Type_Profile) {
  const api = threeCapi(profileData)
  if (!api) return false

  // this is the /market_orders endpoint.
  let apiCall = await api.getDealSafetyOrders(String(deal_id))

  let manualSOs = []

  for (let order of apiCall) {
    let { deal_order_type, status_string, quantity, quantity_remaining, total, rate, average_price } = order
    if (deal_order_type === "Manual Safety") {
      manualSOs.push({ deal_order_type, status_string, quantity, quantity_remaining, total, rate, average_price })
    }
  }
  return {
    filled: manualSOs.filter(deal => deal.status_string === 'Filled'),
    failed: manualSOs.filter(deal => deal.status_string === 'Cancelled'),
    active: manualSOs.filter(deal => deal.status_string === 'Active')
  }

}


// TODO this can be merged with gerMarketOrders
/**
 * @param profileData
 * @param {number} deal_id The deal id of an active deal
 *
 * @description Fetching market orders for bots that are active and have active market orders
 * @api_docs - https://github.com/3commas-io/3commas-official-api-docs/blob/master/deals_api.md#deal-safety-orders-permission-bots_read-security-signed
 */
async function getDealOrders(profileData: Type_Profile, deal_id: number) {
  const api = threeCapi(profileData)
  if (!api) return []

  // this is the /market_orders endpoint.
  const data = await api.getDealSafetyOrders(String(deal_id))

  return (!data) ? [] :
    data.map((order: Type_MarketOrders) => {

      // market orders do not use the rate metric, but active orders do not use the average price
      const rate = (order.rate != 0) ? +order.rate : +order.average_price;

      // total is blank for active deals. Calculating the total to be used within the app.
      if (order.status_string === 'Active' && order.rate && order.quantity) order.total = rate * order.quantity
      return {
        ...order,
        average_price: +order.average_price, // this is zero on sell orders
        quantity: +order.quantity,
        quantity_remaining: +order.quantity_remaining,
        rate,
        total: +order.total,
      }
    })

}


// This may need to be looked at a bit. But for now it's just an array that runs and stores the active deals.
let activeDealIDs = <number[]>[]


/**
 * 
 * @param {number} offset - Total to sync per update
 * @returns object array of deals.
 */
async function getDealsUpdate(perSyncOffset: number, type: string, profileData: Type_Profile) {
  const api = threeCapi(profileData)
  if (!api) return {
    deals: [],
    lastSyncTime: profileData.syncStatus.deals.lastSyncTime
  }

  let activeDeals = <[] | threeCommas_Api_Deals[]>[]

  if (type === 'autoSync') {
    activeDeals = await getActiveDeals(api, perSyncOffset)
    const newActiveDealIds = activeDeals.map(deal => deal.id)

    // this logic is if the active deals match, just return since nothing has changed. 
    // if they don't match go and fetch all the deals.
    if (activeDealIDs === newActiveDealIds) {
      return { deals: activeDeals, lastSyncTime: profileData.syncStatus.deals.lastSyncTime }
    }
    activeDealIDs = newActiveDealIds;
  }

  const { deals, lastSyncTime } = await getDealsThatAreUpdated(api, perSyncOffset, { id: profileData.id, lastSyncTime: profileData.syncStatus.deals.lastSyncTime })

  return { deals: [...deals, ...activeDeals], lastSyncTime: lastSyncTime }
}

async function getActiveDeals(api: threeCommasAPI, perSyncOffset = 300) {
  const response = await api.getDeals({ limit: perSyncOffset, scope: 'active' })
  return response
}

async function getDealsThatAreUpdated(api: threeCommasAPI, perSyncOffset: number, { id, lastSyncTime }: { id: string, lastSyncTime: number | null }) {
  let responseArray = [];
  let response: threeCommas_Api_Deals[];
  let offsetMax = 250000;
  let perOffset = (perSyncOffset) ? perSyncOffset : 1000;
  let oldestDate;
  let newLastSyncTime;

  lastSyncTime = (lastSyncTime) ? lastSyncTime : 0;

  // api.getDeals

  for (let offset = 0; offset < offsetMax; offset += perOffset) {

    // this now filters out any deals that were cancelled or failed due a bug in how 3C reports that data.
    response = await api.getDeals({ limit: perOffset, order: 'updated_at', order_direction: 'desc', offset, scope: 'active, completed, finished' })
    if (response.length > 0) { responseArray.push(...response) }

    // this pulls the oldest date of the final item in the array.
    oldestDate = new Date(response[response.length - 1].updated_at).getTime()


    if (offset == 0) newLastSyncTime = new Date(response[0].updated_at).getTime()


    log.debug({
      'responseArrayLength': responseArray.length,
      'currentResponse': response.length,
      offset,
      sync: {
        oldest: oldestDate,
        newest: new Date(response[0].updated_at).getTime()
      },
      newLastSyncTime,
      lastSyncTime
    })

    if (response.length != perOffset || oldestDate <= lastSyncTime) { break; }

  }

  log.info('Response data Length: ' + responseArray.length)
  if (lastSyncTime != newLastSyncTime) { setProfileConfig('syncStatus.deals.lastSyncTime', newLastSyncTime ?? 0, id) }
  return {
    deals: responseArray,
    lastSyncTime: (lastSyncTime != newLastSyncTime) ? newLastSyncTime ?? 0 : lastSyncTime
  }
}


async function deals(offset: number, type: string, profileData: Type_Profile) {
  let { deals, lastSyncTime } = await getDealsUpdate(offset, type, profileData);
  let dealArray = [];

  if (!deals || deals.length === 0) return { deals: [], lastSyncTime }


  for (let deal of deals) {
    const {
      created_at, closed_at, bought_volume,
      base_order_volume, safety_order_volume,
      completed_safety_orders_count, martingale_volume_coefficient,
      final_profit_percentage, pair, id, actual_usd_profit,
      active_manual_safety_orders, bought_average_price,
      current_price, actual_profit, final_profit, active_safety_orders_count,
      completed_manual_safety_orders_count, current_active_safety_orders
    } = deal

    const activeDeal = closed_at === null;

    const newDealObject = {
      id: deal.id,
      type: deal.type,
      bot_id: deal.bot_id,
      // this fix is for a bug in 3C where the active SO can be greater than 0 with max safety orders being lower which causes a mis calculation and ignoring all the SOs.
      max_safety_orders: Math.max(completed_safety_orders_count + current_active_safety_orders, deal.max_safety_orders),
      deal_has_error: deal?.deal_has_error,
      from_currency_id: deal?.from_currency_id,
      to_currency_id: deal?.to_currency_id,
      account_id: deal.account_id,
      active_safety_orders_count: deal.active_safety_orders_count,
      created_at: deal.created_at,
      updated_at: deal.updated_at,
      closed_at,
      closed_at_iso_string: (activeDeal) ? null : new Date(closed_at).getTime(),

      //@ts-ignore
      finished: deal['finished?'],
      current_active_safety_orders_count: deal.current_active_safety_orders_count,
      current_active_safety_orders: deal.current_active_safety_orders,
      completed_safety_orders_count: deal.completed_safety_orders_count,

      //@ts-ignore
      cancellable: deal['cancellable?'],

      //@ts-ignore
      panic_sellable: deal['panic_sellable?'],
      trailing_enabled: deal?.trailing_enabled,
      tsl_enabled: deal?.tsl_enabled,
      stop_loss_timeout_enabled: deal?.stop_loss_timeout_enabled,
      stop_loss_timeout_in_seconds: deal?.stop_loss_timeout_in_seconds,
      active_manual_safety_orders: deal.active_manual_safety_orders,
      pair: deal.pair,
      status: deal.status,
      localized_status: deal?.localized_status,
      take_profit: deal.take_profit,
      base_order_volume: deal.base_order_volume,
      safety_order_volume: deal.safety_order_volume,
      safety_order_step_percentage: deal.safety_order_step_percentage,
      leverage_type: deal?.leverage_type,
      leverage_custom_value: deal?.leverage_custom_value,
      bought_amount: deal.bought_amount,
      bought_volume: deal.bought_volume,
      bought_average_price: deal.bought_average_price,
      base_order_average_price: deal.base_order_average_price,
      sold_amount: deal.sold_amount,
      sold_volume: deal.sold_volume,
      sold_average_price: deal.sold_average_price,
      take_profit_type: deal.take_profit_type,
      final_profit: deal.final_profit,
      martingale_coefficient: deal.martingale_coefficient,
      martingale_volume_coefficient: deal.martingale_volume_coefficient,
      martingale_step_coefficient: deal.martingale_step_coefficient,
      stop_loss_percentage: deal.stop_loss_percentage,
      error_message: deal.error_message,
      profit_currency: deal.profit_currency,
      stop_loss_type: deal.stop_loss_type,
      safety_order_volume_type: deal.safety_order_volume_type,
      base_order_volume_type: deal.base_order_volume_type,
      from_currency: deal.from_currency,
      to_currency: deal.to_currency,
      current_price: deal.current_price,
      take_profit_price: deal.take_profit_price,
      stop_loss_price: deal.stop_loss_price,
      final_profit_percentage: deal.final_profit_percentage,
      actual_profit_percentage: deal.actual_profit_percentage,
      bot_name: deal.bot_name,
      account_name: deal.account_name,
      usd_final_profit: deal.usd_final_profit,
      actual_profit: deal.actual_profit,
      actual_usd_profit: deal.actual_usd_profit,
      failed_message: deal.failed_message,
      reserved_base_coin: deal.reserved_base_coin,
      reserved_second_coin: deal.reserved_second_coin,
      trailing_deviation: deal.trailing_deviation,
      trailing_max_price: deal.trailing_max_price,
      tsl_max_price: deal.tsl_max_price,
      strategy: deal.strategy,
      reserved_quote_funds: deal.reserved_quote_funds,
      reserved_base_funds: deal.reserved_base_funds
    } as threeCommas_Api_Deals

    const deal_hours = calc_dealHours(created_at, closed_at)
    let market_order_data = <{ filled: any[], failed: any[], active: any[] }>{ filled: [], failed: [], active: [] }

    // This potentially adds a heavy API call to each sync, requiring it to hit the manual SO endpoint every sync.
    // fetching market order information for any deals that are not closed.
    if (active_manual_safety_orders > 0 || completed_manual_safety_orders_count > 0) {
      let fetched_market_order_data = await getMarketOrders(id, profileData)
      if (fetched_market_order_data) market_order_data = fetched_market_order_data
    }

    let tempObject = {

      // this is recalculated based on the active and completed SOs
      realized_actual_profit_usd: (activeDeal) ? null : +actual_usd_profit,
      deal_hours,
      pair: pair.split("_")[1],
      currency: pair.split("_")[0],

      // updated this value to be accurate based on what's actually been completed
      completed_manual_safety_orders_count: market_order_data.filled.length,

      max_deal_funds: (activeDeal) ? calc_maxDealFunds_Deals(+bought_volume, +base_order_volume, +safety_order_volume, +deal.max_safety_orders, completed_safety_orders_count, +martingale_volume_coefficient, market_order_data.active) : null,
      profitPercent: (activeDeal) ? null : ((+final_profit_percentage / 100) / +deal_hours).toFixed(3),
      impactFactor: (activeDeal) ? (((+bought_average_price - +current_price) / +bought_average_price) * (415 / (Number(bought_volume) ** 0.618))) / (+actual_usd_profit / +actual_profit) : null,
      // final_profit: +final_profit,
      // final_profit_percentage: +final_profit_percentage
    }

    dealArray.push({ ...newDealObject, ...tempObject })
  }

  return {
    deals: dealArray,
    lastSyncTime
  }
}


/**
 *
 * @returns - Account data for enabled accounts on the profile.
 * 
 * @docs - https://github.com/3commas-io/3commas-official-api-docs/blob/master/accounts_api.md#information-about-all-user-balances-on-specified-exchange--permission-accounts_read-security-signed
 */
async function getAccountDetail(profileData: Type_Profile) {
  const api = threeCapi(profileData)
  if (!api) return []

  let accountData = await api.accounts()
  let array = [];
  const accountIDs = profileData.statSettings.reservedFunds.filter(a => a.is_enabled).map(a => a.id)

  for (let account of accountData.filter((a: any) => accountIDs.includes(a.id))) {

    // this loads the account balances from the exchange to 3C ensuring the numbers are updated
    await api.accountLoadBalances(String(account.id));
    // this is where we get the coins and position per account.
    let data = await api.accountTableData(String(account.id))

    const { name: account_name, exchange_name, market_code } = account
    // Load data into new array with only the columns we want and format them
    for (let row of data) {

      const { account_id, currency_code, percentage, position, btc_value, usd_value, on_orders, currency_slug } = row
      let tempObject = {
        id: account_id + "-" + currency_slug,
        account_id,
        account_name,
        exchange_name,
        currency_code,
        percentage,
        position,
        on_orders,
        btc_value,
        usd_value,
        market_code,
      }
      array.push(tempObject);
    }
  }

  return array
}


// TODO replace this with the get account detail function with some conditional logic
async function getAccountSummary(profileData?: Type_Profile, key?: string, secret?: string, mode?: string) {
  let api = threeCapi(profileData, key, secret, mode)
  if (!api) return []
  let accountData = await api.accounts()

  let array = []

  for (let account of accountData) {
    const { id, name } = account
    array.push({ id, name })
  }

  return array;
}

async function updateDeal(profileData: Type_Profile, deal: UpdateDealRequest) {
  let api = threeCapi(profileData)
  if (!api) return false

  return await api.updateDeal(deal)
}



export {
  getDealsUpdate,
  getAccountDetail,
  deals,
  bots,
  getAccountSummary,
  getDealOrders,
  updateDeal
}
