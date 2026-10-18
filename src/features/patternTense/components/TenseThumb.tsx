import React, {useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {MaterialIcon} from '@ui/components/MaterialIcon';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

/**
 * Default faces of a tense without a picture (or whose picture cannot load),
 * by its time. Like the hero cards, they keep these colours in every theme.
 */
const TIME_FACES = {
  past: {from: '#f7c96b', to: '#c8732f', icon: 'replay'},
  present: {from: '#5fd6c4', to: '#1f7a99', icon: 'schedule'},
  future: {from: '#f59bb0', to: '#6c5bc4', icon: 'flag'},
  other: {from: '#9fd8a6', to: '#3f8f6b', icon: 'style'},
} as const;

type Props = {
  /** Unique on the screen: names the SVG gradients. */
  id: string;
  imageUrl: string | null | undefined;
  time: string | null;
  iconSize: number;
  testID?: string;
};

/**
 * The picture behind a tense's tile or hero, filling its parent (which sets
 * `overflow: 'hidden'` and the radius), with a scrim that darkens the top a
 * little and the bottom more, so white text on it stays readable.
 */
export function TenseThumb({id, imageUrl, time, iconSize, testID}: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  const face =
    TIME_FACES[(time ?? 'other') as keyof typeof TIME_FACES] ??
    TIME_FACES.other;
  const gradientId = id.replace(/[^A-Za-z0-9_-]/g, '_');

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {showImage ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setFailedUrl(imageUrl ?? null)}
          resizeMode="cover"
          source={{uri: imageUrl!}}
          style={StyleSheet.absoluteFill}
          testID={testID ? `${testID}-image` : undefined}
        />
      ) : (
        <View
          style={StyleSheet.absoluteFill}
          testID={testID ? `${testID}-default` : undefined}
        >
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient
                id={`${gradientId}-face`}
                x1="0"
                x2="1"
                y1="0"
                y2="1"
              >
                <Stop offset="0" stopColor={face.from} />
                <Stop offset="1" stopColor={face.to} />
              </LinearGradient>
            </Defs>
            <Rect
              fill={`url(#${gradientId}-face)`}
              height="100%"
              width="100%"
            />
          </Svg>
          <View style={styles.icon}>
            <MaterialIcon
              color={HERO_PALETTE.chip}
              name={face.icon}
              size={iconSize}
            />
          </View>
        </View>
      )}
      <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient
            id={`${gradientId}-scrim`}
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <Stop offset="0" stopColor="#101412" stopOpacity={0.28} />
            <Stop offset="0.28" stopColor="#101412" stopOpacity={0} />
            <Stop offset="0.6" stopColor="#101412" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#101412" stopOpacity={0.82} />
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${gradientId}-scrim)`} height="100%" width="100%" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    opacity: 0.7,
    position: 'absolute',
    right: '12%',
    top: '14%',
  },
});
