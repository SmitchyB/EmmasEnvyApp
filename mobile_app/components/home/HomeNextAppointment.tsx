import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  findNextUpcomingAppointment,
  type Appointment,
  type ServiceType,
} from '@emmasenvy/shared';
import { useAuth } from '@/contexts/AuthContext';
import { useBookingData } from '@/contexts/BookingDataContext';
import { NavbarColors } from '@/constants/theme';
import { formatAppointmentDate, formatAppointmentTimeLabel } from '@/components/home/appointment-format';

type HomeNextAppointmentProps = {
  serviceTypes: ServiceType[];
};

function resolveServiceTitle(a: Appointment, serviceTypes: ServiceType[]): string {
  return (
    (a.service_type_title && String(a.service_type_title).trim()) ||
    (a.service_type_id ? serviceTypes.find((s) => s.id === a.service_type_id)?.title : null) ||
    'Appointment'
  );
}

export function HomeNextAppointment({ serviceTypes }: HomeNextAppointmentProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { appointments, loading } = useBookingData();

  if (!user) {
    return (
      <Pressable
        onPress={() => router.push('/tabs/account')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Sign in to see your appointments"
      >
        <Text style={styles.label}>Appointments</Text>
        <Text style={styles.title}>Sign in to see your appointments</Text>
      </Pressable>
    );
  }

  if (loading && appointments.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>Loading appointments…</Text>
      </View>
    );
  }

  const next = findNextUpcomingAppointment(appointments);
  if (!next) {
    return (
      <Pressable
        onPress={() => router.push('/tabs/appointments')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.label}>Appointments</Text>
        <Text style={styles.title}>No upcoming appointments</Text>
        <Text style={styles.link}>View appointments</Text>
      </Pressable>
    );
  }

  const serviceTitle = resolveServiceTitle(next, serviceTypes);

  return (
    <Pressable
      onPress={() => router.push('/tabs/appointments')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Next appointment ${serviceTitle}`}
    >
      <Text style={styles.label}>Next appointment</Text>
      <Text style={styles.title}>{serviceTitle}</Text>
      <Text style={styles.detail}>
        {formatAppointmentDate(next.date)} at {formatAppointmentTimeLabel(next.time)}
      </Text>
      <Text style={styles.link}>View details</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NavbarColors.border,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: NavbarColors.textMuted,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: NavbarColors.text,
  },
  detail: {
    marginTop: 4,
    fontSize: 14,
    color: NavbarColors.textMuted,
  },
  link: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: NavbarColors.text,
  },
  muted: {
    fontSize: 14,
    color: NavbarColors.textMuted,
  },
});
