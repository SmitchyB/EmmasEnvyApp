//Guest ticket storage module for the guest ticket token

import AsyncStorage from '@react-native-async-storage/async-storage'; // Import the AsyncStorage module from @react-native-async-storage/async-storage

const KEY = '@emmas_support_guest_jwt'; // Define the key for the guest ticket token

//Define the setGuestTicketToken function to set the guest ticket token
export async function setGuestTicketToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY, token); // Set the guest ticket token in the async storage
}

//Define the getGuestTicketToken function to get the guest ticket token
export async function getGuestTicketToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY); // Get the guest ticket token from the async storage
}

//Define the clearGuestTicketToken function to clear the guest ticket token
export async function clearGuestTicketToken(): Promise<void> {
  await AsyncStorage.removeItem(KEY); // Remove the guest ticket token from the async storage
}
