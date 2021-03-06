import React, { useEffect, useState } from 'react';
// import { InputLabel, MenuItem, FormControl, Select } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import NoData from '@/app/Pages/Stats/Components/NoData';
import { currencyTooltipFormatter } from '@/app/Components/Charts/formatting'
import { getFiltersQueryString } from '@/app/Features/3Commas/3Commas';
import { useAppSelector } from '@/app/redux/hooks';
import { parseNumber } from '@/utils/number_formatting';

import type { Type_Tooltip, Type_SoDealDis } from '@/types/Charts';
import type{Type_SoDistributionArray} from '@/types/3Commas'



// TODO
// Need to add a bot filter
// need to add a pair filter
// move the bot / pair data to be in the global state
// add the query to the 3C table
//
const SoDealDistribution = ({data = [], defaultCurrency }: Type_SoDealDis) => {

    // const safety_order = useAppSelector(state => state.threeCommas.performanceData.safety_order)

    const [soData, updateData] = useState<Type_SoDistributionArray[]>([]);

    useEffect(() => {
        updateData(data ?? [])
    }, [data])

    const renderChart = () => {
        if (soData.length === 0) {
            return (<NoData />)
        }
        return (
            <ResponsiveContainer width="100%" height="90%" minHeight="300px">
                <BarChart
                    width={500}
                    height={200}
                    data={soData}
                    margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                    stackOffset="expand"
                    maxBarSize={50}
                    barGap={1}
                    style={{
                        marginTop: '1em'
                    }}
                >
                    <Legend />
                    <CartesianGrid opacity={.3} vertical={false} />

                    {/* TODO - pass the custom props down properly here.  */}
                    {/* @ts-ignore */}
                    <Tooltip content={<CustomTooltip formatter={(value: any) => currencyTooltipFormatter(value, defaultCurrency)} />} cursor={{ strokeDasharray: '3 3', opacity: .2 }} />
                    <XAxis
                        dataKey="completed_safety_orders_count"
                        minTickGap={-200}
                        axisLine={false}
                        // label="SO"
                        height={45}
                    />

                    <YAxis tickFormatter={tick => parseNumber(tick * 100, 0) + "%"} />


                    <Bar dataKey="percent_deals" fill="var(--chart-metric1-color)" name='% of total deals' />
                    <Bar dataKey="percent_total" fill="var(--chart-metric3-color)" name='% of total profit' />

                </BarChart>
            </ResponsiveContainer>)
    }

    return (
        <div className="boxData stat-chart " >
            <div style={{ position: "relative" }}>
                <h3 className="chartTitle">Completed SO Distribution</h3>
                {/* <div style={{ position: "absolute", right: 0, top: 0, height: "50px", zIndex: 5 }}>
                    <FormControl  style={{marginRight: '.5em'}}>
                        <InputLabel>Filter Bots: </InputLabel>
                        <Select
                            variant="standard"
                            // value={sort}
                            // onChange={handleSortChange}
                            style={{ width: "150px" }}
                        >
                            <MenuItem value="-total_profit">Profit</MenuItem>
                            <MenuItem value="-bought_volume">Bought Volume</MenuItem>
                            <MenuItem value="-avg_deal_hours">Avg. Deal Hours</MenuItem>
                            <MenuItem value="-avg_profit">Avg. Profit</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl>
                        <InputLabel>Filter Pairs</InputLabel>
                        <Select
                            variant="standard"
                            // value={5}
                            // onChange={handleFilterChange}
                            style={{ width: "150px" }}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="top20">Top 20%</MenuItem>
                            <MenuItem value="top50">Top 50%</MenuItem>
                            <MenuItem value="bottom50">Bottom 50%</MenuItem>
                            <MenuItem value="bottom20">Bottom 20%</MenuItem>
                        </Select>
                    </FormControl>
                </div> */}

            </div>



            {renderChart()}
        </div>
    )
}


function CustomTooltip({ active, payload, label, formatter }: Type_Tooltip) {
    if (!active || payload.length == 0 || payload[0] == undefined) {
        return null
    }

    const data: Type_SoDistributionArray = payload[0].payload

    const { completed_safety_orders_count, percent_total, total_profit, percent_deals, total_deals } = data
    return (
        <div className="tooltip">
            <h4>SO # {completed_safety_orders_count}</h4>
            <p><strong>Total Deals:</strong> {total_deals}</p>
            <p><strong>Percent Total Profit: </strong> {parseNumber((percent_total * 100), 2)} %</p>
            <p><strong>Percent Total Deals: </strong> {parseNumber((percent_deals * 100), 2)} %</p>
            <p><strong>Total Profit:</strong> {formatter(total_profit)}</p>
        </div>
    )
}

export default SoDealDistribution;