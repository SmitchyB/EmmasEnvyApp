import { Tabs } from 'expo-router'; // Import the Tabs component from expo-router
import React from 'react';
import { HapticTab } from '@/components/haptic-tab'; // Import the HapticTab component from the components folder
import { IconSymbol } from '@/components/ui/icon-symbol'; // Import the IconSymbol component from the components folder
import { NavbarColors } from '@/constants/theme'; // Import the NavbarColors constant from the constants folder

//This is the layout for the tabs at the bottom of the screen.
export default function TabLayout() {
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
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="portfolios"
        options={{
          title: 'Portfolios',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="folder.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="bag.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Sign In/Up',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.circle" color={color} />,
        }}
      />
    </Tabs>
  );
}
