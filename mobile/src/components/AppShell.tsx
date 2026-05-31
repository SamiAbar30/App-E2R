import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Accessibility,
  Bell,
  History,
  Home,
  Menu,
  ScanLine,
} from 'lucide-react-native';
import {
  useContrastPalette,
  useEffectiveFontScale,
  useInteractionAccessibility,
} from '../hooks/useAccessibilityEngine';

export const appTheme = {
  background: '#fcf9f8',
  surface: '#ffffff',
  surfaceAlt: '#F7F9FC',
  primary: '#004275',
  primaryStrong: '#005a9c',
  primarySoft: '#E8F4FD',
  primaryText: '#ffffff',
  secondary: '#1b6d24',
  secondarySoft: '#a0f399',
  secondaryText: '#217128',
  danger: '#C62828',
  dangerSoft: '#ffdad6',
  dangerText: '#93000a',
  text: '#1c1b1b',
  muted: '#5f6670',
  border: '#c1c7d2',
};

type ActiveTab = 'home' | 'scan' | 'history' | 'settings' | 'none';

type AppShellProps = {
  title: string;
  children: React.ReactNode;
  activeTab?: ActiveTab;
  onHome: () => void;
  onScan: () => void;
  onHistory: () => void;
  onSettings: () => void;
  scroll?: boolean;
  showBottomNav?: boolean;
  rightAction?: React.ReactNode;
};

export function AppShell({
  title,
  children,
  activeTab = 'none',
  onHome,
  onScan,
  onHistory,
  onSettings,
  scroll = true,
  showBottomNav = true,
  rightAction,
}: AppShellProps) {
  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();
  const background = palette.background || appTheme.background;

  const content = scroll ? (
    <ScrollView
      style={styles.contentScroll}
      contentContainerStyle={[
        styles.content,
        showBottomNav && styles.contentWithBottomNav,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.contentStatic, showBottomNav && styles.contentWithBottomNav]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.iconButton, { minHeight: minTouchSize, minWidth: minTouchSize }]}
          onPress={onHome}
          accessibilityRole="button"
          accessibilityLabel="Inicio"
        >
          <Menu color={appTheme.primary} size={26} strokeWidth={2.4} />
        </TouchableOpacity>

        <Text
          style={[styles.title, { fontSize: 22 * Math.min(fontScale, 1.35) }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>

        {rightAction ?? (
          <TouchableOpacity
            onPress={onSettings}
            style={[styles.iconButton, { minHeight: minTouchSize, minWidth: minTouchSize }]}
            accessibilityRole="button"
            accessibilityLabel="Ajustes de accesibilidad"
          >
            {activeTab === 'settings' ? (
              <Accessibility color={appTheme.primaryStrong} size={25} strokeWidth={2.5} />
            ) : (
              <Bell color={appTheme.primary} size={22} strokeWidth={2.4} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {content}

      {showBottomNav && (
        <View style={styles.bottomNav}>
          <BottomNavButton
            label="Inicio"
            active={activeTab === 'home'}
            icon={<Home color={activeTab === 'home' ? appTheme.primary : '#414750'} size={22} />}
            onPress={onHome}
          />
          <TouchableOpacity
            style={styles.scanButton}
            onPress={onScan}
            accessibilityRole="button"
            accessibilityLabel="Escanear"
            accessibilityState={{ selected: activeTab === 'scan' }}
          >
            <ScanLine color={appTheme.primaryText} size={25} strokeWidth={2.6} />
          </TouchableOpacity>
          <BottomNavButton
            label="Historial"
            active={activeTab === 'history'}
            icon={<History color={activeTab === 'history' ? appTheme.primary : '#414750'} size={22} />}
            onPress={onHistory}
          />
          <BottomNavButton
            label="Ajustes"
            active={activeTab === 'settings'}
            icon={<Accessibility color={activeTab === 'settings' ? appTheme.primary : '#414750'} size={22} />}
            onPress={onSettings}
          />
        </View>
      )}
    </View>
  );
}

function BottomNavButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.bottomNavItem}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {icon}
      <Text style={[styles.bottomNavText, active && styles.bottomNavTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: appTheme.surfaceAlt,
    borderBottomColor: appTheme.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 76,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
  },
  title: {
    color: appTheme.primary,
    flex: 1,
    fontWeight: '900',
    letterSpacing: 0,
    marginHorizontal: 12,
    textAlign: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    gap: 22,
    padding: 20,
  },
  contentStatic: {
    flex: 1,
  },
  contentWithBottomNav: {
    paddingBottom: 112,
  },
  bottomNav: {
    alignItems: 'center',
    backgroundColor: appTheme.surfaceAlt,
    borderTopColor: appTheme.border,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    left: 0,
    minHeight: 82,
    paddingBottom: 12,
    paddingHorizontal: 10,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  bottomNavItem: {
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    minWidth: 62,
  },
  bottomNavText: {
    color: '#414750',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomNavTextActive: {
    color: appTheme.primary,
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: appTheme.primaryStrong,
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 76,
  },
});
