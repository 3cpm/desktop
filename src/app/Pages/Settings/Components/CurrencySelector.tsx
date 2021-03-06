import React, { useState, useEffect } from 'react';
import { formatCurrency, supportedCurrencies } from '@/utils/granularity';

import { useAppSelector, useAppDispatch } from '@/app/redux/hooks';
import { configPaths } from "@/app/redux/globalFunctions";
import { updateEditProfileByPath } from "@/app/Pages/Settings/Redux/settingsSlice";

import { 
    FormControl, InputLabel, MenuItem, Select,
    ListItemText, Checkbox, ListSubheader
} from '@mui/material';

const returnCurrencyMenuItems = (currencyArray: typeof supportedCurrencies) => {
    const usd: (typeof supportedCurrencies.USD)[] = [];
    const crypto: (typeof supportedCurrencies.USD)[] = [];

    for (const currency in currencyArray) {
        let tempCurrency = currencyArray[currency as keyof typeof supportedCurrencies]
        if (tempCurrency.type === 'usd') {
            usd.push(tempCurrency)
        } else {
            crypto.push(tempCurrency)
        }
    }

    return {
        usd,
        crypto
    }

}

const CurrencySelector = () => {
    const defaultCurrency = useAppSelector(state => state.settings.editingProfile.general.defaultCurrency);
    const dispatch = useAppDispatch()
    const handleChange = (data: any) => {
        dispatch(updateEditProfileByPath({ data, path: configPaths.general.defaultCurrency }))
    }

    const { usd, crypto } = returnCurrencyMenuItems(supportedCurrencies)
    const usdNames = usd.map(c => c.value)
    const onChange = (e: any) => {
        if (e.target.value.some((cur: string) => !Object.keys(supportedCurrencies).includes(cur))) {
            console.error('No matching currency code found.')
            return false
        }

        const isUSD = e.target.value.some((r: string) => usdNames.includes(r))
        if (isUSD) {
            const isAllUsd = e.target.value.every((v: string) => usdNames.includes(v));
            if (!isAllUsd) {
                handleChange([])
                return alert('Warning. You cannot mix currencies that are not USD based.')
            }
            handleChange([...e.target.value])
            return
        }

        // selecting only the last value so there are not multiple crypto currencies selected at a time.
        const selected = (e.target.value.length > 1) ? [e.target.value.pop()] : [...e.target.value];
        handleChange(selected)
    }

    const [open, setOpen] = useState(false);
    const handleClose = () => setOpen(false);
    const handleOpen = () => setOpen(true);

    return (
        <FormControl style={{ width: '100%', marginBottom: '25px' }} fullWidth>
            <InputLabel id="currency-label">Stat / Metric Currency</InputLabel>
            <Select
                labelId="currency-label"
                multiple
                id="currency"
                name="currency"
                label="Stat / Metric Currency"
                value={defaultCurrency}
                onChange={onChange}
                renderValue={() => (defaultCurrency.length > 0) ? defaultCurrency.join(', ') : ""}
                style={{
                    marginRight: '15px',
                    width: '100%'
                }}
                open={open}
                onClose={handleClose}
                onOpen={handleOpen}
            >
                < ListSubheader > USD</ListSubheader>


                {usd.map(c => {
                    return (
                        <MenuItem value={c.value} key={c.value}>

                            {/* @ts-ignore */}
                            <Checkbox checked={defaultCurrency.indexOf(c.value) > - 1} />
                            <ListItemText primary={c.value + ` (${c.name})`} />
                        </MenuItem>
                    )
                })}

                <ListSubheader>Crypto</ListSubheader>
                {crypto.map(c => {
                    return (
                        <MenuItem value={c.value} key={c.value} style={{ height: '54px' }} onClick={() => handleClose()}>
                            <ListItemText primary={c.value + ` (${c.name})`} />
                        </MenuItem>
                    )
                })}
            </Select>
        </FormControl >
    )
}

export default CurrencySelector
