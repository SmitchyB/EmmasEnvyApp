import { Tabs } from 'expo-router'; // Import the Tabs component from expo-router for the tabs
import React from 'react'; // Import the React component from react for the tabs
import { Image, StyleSheet, View } from 'react-native'; // Import the Image, StyleSheet, and View from react-native for the tabs
import { HapticTab } from '@/components/haptic-tab'; // Import the HapticTab component from @/components/haptic-tab for the tabs
import { IconSymbol } from '@/components/ui/icon-symbol'; // Import the IconSymbol component from @/components/ui/icon-symbol for the tabs
import { uploadsUrl } from '@/constants/config'; // Import the uploadsUrl function from @/constants/config for the tabs
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors constant from @/constants/theme for the tabs
import { useAuth } from '@/contexts/AuthContext'; // Import the useAuth hook from @/contexts/AuthContext for the tabs

//Summary of changes for Week 2 submission:
//Changed the Sign In/Up and Account Tab functionality to use the users profile picture if available
//Ensured sizing of the icons are consistent and the profile picture is sized accordingly.

const TAB_ICON_SIZE = 24; //Define the size of the icon for the tabs

/** TabLayout is the layout component for the tabs. It is the layout for the tabs. */
export default function TabLayout() {
  const { user } = useAuth();
  const profilePhotoUrl = user?.profile_picture ? uploadsUrl(user.profile_picture) : null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: NavbarColors.text,
        tabBarInactiveTintColor: NavbarColors.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: NavbarColors.border,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={TAB_ICON_SIZE} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="portfolios"
        options={{
          title: 'Portfolios',
          tabBarIcon: ({ color }) => <IconSymbol size={TAB_ICON_SIZE} name="folder.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color }) => <IconSymbol size={TAB_ICON_SIZE} name="bag.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: user ? 'Account' : 'Sign In/Up',
          tabBarIcon: ({ color }) =>
            profilePhotoUrl ? (
              <View style={[styles.avatarWrap, { borderColor: color }]}>
                <Image source={{ uri: profilePhotoUrl }} style={styles.avatar} />
              </View>
            ) : (
              <IconSymbol size={TAB_ICON_SIZE} name="person.circle" color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    width: TAB_ICON_SIZE,
    height: TAB_ICON_SIZE,
    borderRadius: TAB_ICON_SIZE / 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
});
