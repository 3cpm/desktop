import { TconfigValues, Type_Profile } from '@/types/config';
import { defaultConfig, defaultProfile } from '@/utils/defaultConfig';
import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { updateProfileByPath } from '@/app/redux/globalFunctions';

// Define the initial state using that type
const initialState = {
    config: <TconfigValues>defaultConfig,
    currentProfile: <Type_Profile>defaultProfile,
}

export const configSlice = createSlice({
    name: 'config',
    initialState,
    reducers: {
        setConfig: (state, action) => {
            console.log('setting the config')
            state.config = action.payload
        },
        setCurrentProfile: (state, action) => {
            state.currentProfile = action.payload
        },
        setCurrentProfileById: (state, action) => {
            const { profileId } = action.payload
            const newConfig = { ...state.config }
            state.currentProfile = { ...newConfig.profiles[profileId] }
            state.config = { ...newConfig, current: profileId }
        },
        updateLastSyncTime: (state, action) => {
            const { data } = action.payload
            let newProfile = Object.assign({}, { ...state.currentProfile })
            newProfile.syncStatus.deals.lastSyncTime = data
            state.currentProfile = newProfile
        },
        updateCurrentProfileByPath: (state, action) => {
            const { data, path } = action.payload
            const newProfile = updateProfileByPath(data, Object.assign({}, { ...state.currentProfile }), path)
            const newConfig = { ...state.config }
            newConfig.profiles[newProfile.id] = newProfile
            state.config = newConfig
            state.currentProfile = newProfile
        },
        deleteProfileById: (state, action) => {
            const { profileId } = action.payload
            const profileKeys = Object.keys(state.config.profiles)
            if (profileKeys.length > 1) {
                const newConfig = { ...state.config }
                delete newConfig.profiles[profileId]

                // setting this to the top profile
                newConfig.current = Object.keys(newConfig.profiles)[0]
                state.config = newConfig
            } else {
                console.error('You cannot delete all your profiles. It looks like your down to the last one.')
            }
        },
        // this is my bug
        addConfigProfile: state => {
            state.currentProfile = { ...defaultProfile, id: uuidv4() }
        },
        updateNotificationsSettings: (state, action) => {
            const newConfig = { ...state.config }
            newConfig.globalSettings.notifications = {
                ...state.config.globalSettings.notifications,
                ...action.payload,
            }
            state.config = newConfig
        },
    }
})

export const {
    setConfig, setCurrentProfile, 
    updateCurrentProfileByPath, deleteProfileById, addConfigProfile,
    setCurrentProfileById,
    updateLastSyncTime,
    updateNotificationsSettings,
} = configSlice.actions;

export default configSlice.reducer