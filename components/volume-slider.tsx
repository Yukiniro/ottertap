import { useRef, type ComponentProps } from 'react';
import { Slider } from './ui/slider';
import { snapDraggedVolume, snapVolumeStep } from '../lib/volume';

type Props = Omit<ComponentProps<typeof Slider>, 'value' | 'defaultValue' | 'min' | 'step' | 'onValueChange' | 'onValueCommitted'> & {
  value: number;
  onValueChange: (percent: number) => void;
  onValueCommitted?: (percent: number) => void;
};

export function VolumeSlider({ value, onValueChange, onValueCommitted, ...props }: Props) {
  const current = useRef(value);
  current.current = value;
  return <Slider {...props} min={0} step={1} value={[value]} onValueChange={(values, details) => {
    const raw = Array.isArray(values) ? values[0] : values;
    if (raw === undefined) return;
    const key = 'key' in details.event ? details.event.key : '';
    const next = details.reason === 'drag' || details.reason === 'track-press'
      ? snapDraggedVolume(raw)
      : key === 'Home' || key === 'End' ? raw : snapVolumeStep(current.current, raw);
    current.current = next;
    onValueChange(next);
  }} onValueCommitted={() => onValueCommitted?.(current.current)} />;
}
