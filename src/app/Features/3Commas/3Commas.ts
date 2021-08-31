import {
    Type_Query_PerfArray,
    Type_Query_DealData,
    Type_Profit,
    Type_ActiveDeals,
    Type_Query_Accounts,
    Type_UpdateFunction
} from '@/types/3Commas'

import { Type_ReservedFunds } from '@/types/config'


interface Type_ProfitArray extends Array<Type_Profit> { }

const getFiltersQueryString = async () => {

    // @ts-ignore
    const config = await electron.config.get()

    const { statSettings: { startDate, reservedFunds }, general: { defaultCurrency } } = config

    const currencyString = (defaultCurrency) ? defaultCurrency.map((b: string) => "'" + b + "'") : ""
    const startString = startDate
    const accountIdString = reservedFunds.filter((account: Type_ReservedFunds) => account.is_enabled).map((account: Type_ReservedFunds) => account.id)


    return {
        currencyString,
        accountIdString,
        startString
    }

}


interface Type_Update{
    offset: number
    lastSyncTime?:number
    summary?: boolean
}

/**
 * @description This kicks off the update process that updates all 3Commas data within the database.
 * 
 * @params - type 'autoSync'
 * @params {options} - option string
 */
const updateThreeCData = async (type: string, options: Type_UpdateFunction  ) => {

    console.info({options})

    // @ts-ignore
    await electron.api.update(type, options);
}


// Filtering by only closed.
// This can most likely be moved to the performance dashboard or upwards to the app header.
const fetchDealDataFunction = async () => {
    const filtersQueryString = await getFiltersQueryString()
    const { currencyString, accountIdString, startString } = filtersQueryString;
    const query = `
            SELECT 
                substr(closed_at, 0, 11) as closed_at_str,
                sum(final_profit) as final_profit,
                sum(deal_hours) as deal_hours,
                count(id) as total_deals
            FROM 
                deals 
            WHERE
                closed_at != null 
                or finished = 1 
                and account_id in (${accountIdString} )
                and currency in (${currencyString} )
                and closed_at_iso_string > ${startString} 
            GROUP BY
                 closed_at_str
            ORDER BY
                closed_at asc;`

    // @ts-ignore
    let dataArray = await electron.database.query(query)

    // if no data return blank array.
    if (dataArray == null || dataArray.length === 0) {

        return {
            profitData: [],
            metrics: {
                totalProfit: 0,
                averageDailyProfit: 0,
                averageDealHours: 0
            }
        }
    }

    let totalDealHours = dataArray.map((deal: Type_Query_DealData) => deal.deal_hours).reduce((sum: number, hours: number) => sum + hours)

    const profitArray: Type_Profit[] = [];

    dataArray = dataArray.forEach(( day: any, index:number ) => {

        
        // adding the existing value to the previous value's running sum.
        let runningSum = (index == 0) ? day.final_profit  : profitArray[index - 1].runningSum + day.final_profit 

        profitArray.push({
            utc_date: day.closed_at_str,
            profit: day.final_profit,
            runningSum: runningSum,
            total_deals: day.total_deals
        })
    })


    const totalProfit = (profitArray.length > 0) ? +profitArray[profitArray.length - 1].runningSum : 0
    const averageDailyProfit = (profitArray.length > 0) ? totalProfit / (profitArray.length ) : 0;
    const totalClosedDeals = (profitArray.length > 0) ? profitArray.map(day => day.total_deals).reduce( (sum:number, total_deals: number) => sum + total_deals) : 0;
    const averageDealHours = (profitArray.length > 0) ? totalDealHours / totalClosedDeals : 0;
    console.log({totalDealHours, profitArray, totalClosedDeals})

    return {
        profitData: profitArray,
        metrics: {
            totalProfit,
            averageDailyProfit,
            averageDealHours,
            totalClosedDeals,
            totalDealHours
        }
    }

}

const fetchPerformanceDataFunction = async () => {
    const filtersQueryString = await getFiltersQueryString()
    const { currencyString, accountIdString, startString } = filtersQueryString;


    // Filtering by only closed.
    // This can most likely be moved to the performance dashboard or upwards to the app header.

    const queryString = `
                SELECT 
                    bot_id || '-' || pair as performance_id, 
                    bot_name, 
                    pair,
                    avg(profitPercent) as averageHourlyProfitPercent, 
                    sum(final_profit) as total_profit, 
                    count(*) as number_of_deals,
                    sum(bought_volume) as bought_volume,
                    avg(deal_hours) as averageDealHours
                FROM 
                    deals 
                WHERE
                    profitPercent is not null
                    and account_id in (${accountIdString} )
                    and currency in (${currencyString} )
                    and closed_at_iso_string > ${startString} 
                GROUP BY 
                    performance_id;`

    // console.log(queryString)

    // @ts-ignore
    let databaseQuery = await electron.database.query(queryString);

    if (databaseQuery == null || databaseQuery.length > 0) {
        const totalProfitSummary = databaseQuery
            .map((deal: Type_Query_PerfArray) => deal.total_profit)
            .reduce((sum: number, item: number) => sum + item)

        const boughtVolumeSummary = databaseQuery
            .map((deal: Type_Query_PerfArray) => deal.bought_volume)
            .reduce((sum: number, item: number) => sum + item)

        const performanceData = databaseQuery.map((perfData: Type_Query_PerfArray) => {
            const { bought_volume, total_profit } = perfData
            return {
                ...perfData,
                percentTotalVolume: (bought_volume / boughtVolumeSummary) * 100,
                percentTotalProfit: (total_profit / totalProfitSummary) * 100,
            }
        })

        return performanceData
    } else {
        return []
    }


}


/**
 * 
 * @returns An array containing the data for specific bot metrics.
 * 
 */

const fetchBotPerformanceMetrics = async () => {
    const filtersQueryString = await getFiltersQueryString()
    const { currencyString, accountIdString, startString } = filtersQueryString;


    const queryString = `
                SELECT 
                    bot_id, 
                    sum(final_profit) as total_profit, 
                    avg(final_profit) as avg_profit,
                    count(*) as number_of_deals,
                    sum(bought_volume) as bought_volume,
                    avg(deal_hours) as avg_deal_hours,
                    avg(completed_safety_orders_count + completed_manual_safety_orders_count) as avg_completed_so,
                    bots.name as bot_name,
                    bots.type as type
                FROM 
                    deals
                JOIN 
                    bots on deals.bot_id = bots.id
                WHERE
                    closed_at is not null
                    and deals.account_id in (${accountIdString}) 
                    and deals.currency in (${currencyString}) 
                    and deals.closed_at_iso_string > ${startString} 
                GROUP BY 
                    bot_id;`

    // console.log(queryString)

    // @ts-ignore
    let databaseQuery = await electron.database.query(queryString);

    if (databaseQuery == null || databaseQuery.length > 0) {
        return databaseQuery
    } else {
        return []
    }


}

const botQuery = async () => {
    const filtersQueryString = await getFiltersQueryString()
    const { currencyString, accountIdString, startString } = filtersQueryString;


    const queryString = `
                SELECT
                    *
                FROM 
                    bots
                WHERE
                    account_id in (${accountIdString})
                    OR origin = 'custom'`

    // console.log(queryString)

    // @ts-ignore
    let databaseQuery = await electron.database.query(queryString);

    if (databaseQuery == null || databaseQuery.length > 0) {
        return databaseQuery
    } else {
        return []
    }

}

/**
 * 
 * @returns An array containing the data for specific bot metrics.
 */
const fetchPairPerformanceMetrics = async () => {
    const filtersQueryString = await getFiltersQueryString()
    const { currencyString, accountIdString, startString } = filtersQueryString;


    const queryString = `
                SELECT 
                    pair, 
                    sum(final_profit) as total_profit, 
                    avg(final_profit) as avg_profit,
                    count(*) as number_of_deals,
                    sum(bought_volume) as bought_volume,
                    avg(deal_hours) as avg_deal_hours,
                    avg(completed_safety_orders_count + completed_manual_safety_orders_count) as avg_completed_so
                FROM 
                    deals 
                WHERE
                    closed_at is not null
                    and account_id in (${accountIdString}) 
                    and currency in (${currencyString}) 
                    and closed_at_iso_string > ${startString} 
                GROUP BY 
                    pair;`

    // console.log(queryString)

    // @ts-ignore
    let databaseQuery = await electron.database.query(queryString);

    if (databaseQuery == null || databaseQuery.length > 0) {
        return databaseQuery
    } else {
        return []
    }


}


const getActiveDealsFunction = async () => {
    const filtersQueryString = await getFiltersQueryString()

    const { currencyString, accountIdString } = filtersQueryString
    const query = `
                SELECT
                    * 
                FROM
                    deals 
                WHERE
                    finished = 0 
                    and account_id in (${accountIdString} )
                    and currency in (${currencyString} )
                    `
    // console.log(query)
    // @ts-ignore
    let activeDeals: Array<Type_ActiveDeals> = await electron.database.query(query)


    if (activeDeals == null || activeDeals.length > 0) {
        activeDeals = activeDeals.map((row: Type_ActiveDeals) => {
            const so_volume_remaining = row.max_deal_funds - row.bought_volume
            return {
                ...row,
                so_volume_remaining
            }
        })

        return {
            activeDeals,
            metrics: {
                totalBoughtVolume: activeDeals.map((deal: Type_ActiveDeals) => deal.bought_volume).reduce((sum: number, item: number) => sum + item),
                maxRisk: activeDeals.map((deal: Type_ActiveDeals) => deal.max_deal_funds).reduce((sum: number, item: number) => sum + item)
            }

        }

    } else {
        return {
            activeDeals: [],
            metrics: {
                totalBoughtVolume: 0,
                maxRisk: 0
            }

        }
    }
}

/**
 * 
 * @param {string} defaultCurrency This is the default currency configured in settings and used as a filter
 * @returns 
 */
const getAccountDataFunction = async () => {
    // console.log({accountData:  await accountDataAll()})

    const filtersQueryString = await getFiltersQueryString()
    const { currencyString, accountIdString } = filtersQueryString

    const query = `
                SELECT
                    *
                FROM
                    accountData
                WHERE
                    account_id IN ( ${accountIdString} )
                    and currency_code IN ( ${currencyString} );
    `
    console.log(query)

    // @ts-ignore
    let accountData: Array<Type_Query_Accounts> = await electron.database.query(query)

        // removed this since it seems redundant to the above query
        // .then((data: Type_Query_Accounts[]) => data.filter(row => defaultCurrency.includes(row.currency_code)))

    if (accountData == null || accountData.length > 0) {
        let on_ordersTotal = 0;
        let positionTotal = 0;

        for (const account of accountData) {
            const { on_orders, position } = account
            on_ordersTotal += on_orders;
            positionTotal += position;

        }

        // console.log({ on_ordersTotal, positionTotal })
        return {
            accountData,
            balance: {
                on_orders: on_ordersTotal,
                position: positionTotal,
            }
        }
    }

    return {
        accountData: [],
        balance: {
            on_orders: 0,
            position: 0,
        }
    }


}

const accountDataAll = async () => {

    // @ts-ignore
    return await electron.database.query("select * from accountData")

}


export {
    fetchDealDataFunction,
    fetchPerformanceDataFunction,
    getActiveDealsFunction,
    updateThreeCData,
    getAccountDataFunction,
    accountDataAll,
    fetchBotPerformanceMetrics,
    fetchPairPerformanceMetrics,
    botQuery
}

