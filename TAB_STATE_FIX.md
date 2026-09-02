# Tab state persistence fix

Fixed a tab-activation issue where Supabase TOKEN_REFRESHED temporarily put the access gate into loading, unmounting GuestShowroom/AppInner and resetting the current screen. Token refresh now preserves the mounted UI. App route initialization also preserves a valid existing hash when AppInner remounts instead of always replacing it with #home.
