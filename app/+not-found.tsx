import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';

const colors = {
  cream: {
    100: '#fefefe',
  },
  burgundy: {
    500: '#9b1b1b',
  },
  gray: {
    600: '#4b5563',
  },
};

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen does not exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.cream[100],
  },
  title: {
    fontSize: 20,
    fontFamily: 'EBGaramond_600SemiBold',
    fontWeight: '600',
    color: colors.gray[600],
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    color: colors.burgundy[500],
    fontWeight: '600',
  },
});
