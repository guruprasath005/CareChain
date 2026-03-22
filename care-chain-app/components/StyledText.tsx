import { Text as DefaultText, TextProps } from 'react-native';

export function Text(props: TextProps) {
  const { style, ...otherProps } = props;
  
  // Extract fontWeight from style if it exists
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style || {};
  const fontWeight = flatStyle.fontWeight;
  
  // Map fontWeight to DM Sans font family
  let fontFamily = 'DMSans-Regular';
  if (fontWeight === 'bold' || fontWeight === '700') {
    fontFamily = 'DMSans-Bold';
  } else if (fontWeight === '600') {
    fontFamily = 'DMSans-SemiBold';
  } else if (fontWeight === '500') {
    fontFamily = 'DMSans-Medium';
  }
  
  return (
    <DefaultText
      style={[style, { fontFamily }]}
      {...otherProps}
    />
  );
}
