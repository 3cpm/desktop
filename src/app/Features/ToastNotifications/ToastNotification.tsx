import React from 'react';
import {Snackbar, IconButton} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';

interface Type_Snack {
    open: boolean
    handleClose: any
    message: string
}

const ToastNotifcations = ({open, handleClose, message}: Type_Snack) => {
  return (
    <>
      <Snackbar
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        open={open}
        autoHideDuration={3000}
        onClose={handleClose}
        message={message}
        action={
          <>
            <IconButton size="small" aria-label="close" color="inherit" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      />
    </>
  );
}

export default ToastNotifcations;
