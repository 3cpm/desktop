import React, { useEffect, useState } from 'react';
import { UpdateDataButton, ToggleRefreshButton } from '@/app/Components/Buttons/Index'
import { formatDeals } from '@/app/Components/DataTable/Index'
import { ColumnSelector, useColumnSelector } from '@/app/Components/DataTable/Components';

import { useAppSelector } from '@/app/redux/hooks';
import { Card_ActiveDeals, Card_totalInDeals, Card_ActiveDealReserve, Card_TotalDayProfit, Card_TotalUnrealizedProfit, Card_TotalRoi } from '@/app/Components/Charts/DataCards';
import { NotificationsSettings , DealsTable} from './Components/index';

import './ActiveDeals.scss'


const columnList = [
    {
        id: 'bot_name',
        name: 'Bot Name'
    },
    {
        id: 'pair',
        name: 'Pair'
    },
    {
        id: 'created_at',
        name: 'Duration'
    },
    {
        id: 'bought_average_price',
        name: 'Average Price'
    },
    {
        id: 'current_price',
        name: 'Current Price'
    },
    {
        id: 'take_profit_price',
        name: 'Take Profit (TP)'
    },
    {
        id: 'bought_volume',
        name: 'Quote (Bought Volume)'
    },
    {
        id: 'bought_amount',
        name: 'Base (Bought Amount)'
    },
    {
        id: 'current_active_safety_orders',
        name: 'Active SO'
    },
    {
        id: 'safetyOrderString',
        name: '# SO'
    },
    {
        id: 'actual_usd_profit',
        name: '$ Profit'
    },
    {
        id: 'actual_profit_percentage',
        name: '% Profit'
    },
    {
        id: 'unrealized_profit',
        name: 'Unrealized Profit'
    },
    {
        id: 'max_deal_funds',
        name: 'Max Deal Funds'
    },
    {
        id: 'max_deviation',
        name: 'Deviation'
    }
]

const baseColumns = ['id']

const ActiveDealsPage = () => {

    const { activeDeals, metricsData, profitData} = useAppSelector(state => state.threeCommas);
    const { defaultCurrency } = useAppSelector(state => state.config.currentProfile.general);
    const { columns, selectedColumns, handleChange } = useColumnSelector(columnList, 'DealsTable')


    const todaysProfit = (profitData.length > 0) ? profitData[profitData.length - 1].profit : 0 
    const activeDealReserve = (activeDeals.length > 0) ? activeDeals.map( deal => deal.actual_usd_profit ).reduce( (sum, profit) => sum  + profit ) : 0;
    const unrealizedProfitTotal = (activeDeals.length > 0) ? activeDeals.map( deal => ( deal.take_profit / 100 ) * deal.bought_volume).reduce( (sum, profit) => sum  + profit ) : 0;
    
    const { activeDealCount, totalInDeals,  on_orders, totalBoughtVolume, totalBankroll } = metricsData

    const [localData, updateLocalData] = useState<object[]>([])

    useEffect(() => {
        updateLocalData(formatDeals(activeDeals))
    }, [activeDeals])

    
    return (
        <>
            <div className="flex-row headerButtonsAndKPIs">
                <div className="flex-row" style={{ flex: 1, paddingBottom: '.5em' }}>
                    <div className="riskDiv activeDealCards">
                        <Card_ActiveDeals metric={activeDealCount} />
                        <Card_totalInDeals metric={totalInDeals} currency={defaultCurrency} additionalData={{ on_orders, totalBoughtVolume }} />
                        <Card_TotalDayProfit metric={todaysProfit}  currency={defaultCurrency} />
                        <Card_ActiveDealReserve metric={activeDealReserve} currency={defaultCurrency} />
                        <Card_TotalUnrealizedProfit metric={unrealizedProfitTotal} currency={defaultCurrency}  />
                        <Card_TotalRoi title="Today's ROI" additionalData={{totalBankroll, totalProfit:todaysProfit}} currency={defaultCurrency}/>
                    </div>

                </div>

                

            </div>


            <div className="boxData flex-column" style={{padding: '.5em 1em 1em', overflow: 'hidden'}}>
                <div className="tableSettings">

                    <NotificationsSettings />
                    <div className="filters tableButtons" >
                    <ColumnSelector columns={columns} selectedColumns={selectedColumns} handleChange={handleChange} />

                    <ToggleRefreshButton style={{ width: '250px', margin: '5px', height: '38px' }} className={"ToggleRefreshButton"}  />
                    <UpdateDataButton className="CtaButton" style={{ margin: '5px', height: '38px' }} disabled={true} />
                    </div>


                </div>
                <DealsTable data={localData} selectedColumns={[...selectedColumns, ...baseColumns]}/>
            </div>
        </>

    )
}

export default ActiveDealsPage;