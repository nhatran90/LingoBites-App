import React, {useState} from 'react';
import {type LayoutChangeEvent, StyleSheet, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {HERO_PALETTE} from '../theme/heroPalette';

/**
 * The mint-to-sky face of the bright main cards, drawn behind a card's
 * content. The parent sets `overflow: 'hidden'` and its own radius; give
 * each fill on a screen its own `id`.
 *
 * The gradient is drawn at the measured size, not at "100%": a card whose
 * height is only known after its first layout (the review card fills the
 * stage) kept the first, shorter drawing, leaving a flat band at the bottom.
 */
export function HeroFill({id}: {id: string}) {
  const [size, setSize] = useState({width: 0, height: 0});
  const onLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setSize(current =>
      current.width === width && current.height === height
        ? current
        : {width, height},
    );
  };
  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.base]}
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg height={size.height} width={size.width}>
          <Defs>
            <LinearGradient id={id} x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor={HERO_PALETTE.faceFrom} />
              <Stop offset="1" stopColor={HERO_PALETTE.faceTo} />
            </LinearGradient>
          </Defs>
          <Rect fill={`url(#${id})`} height={size.height} width={size.width} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Until the size is known, the solid start colour stands in.
  base: {
    backgroundColor: HERO_PALETTE.faceFrom,
  },
});
