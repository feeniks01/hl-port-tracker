import { useEffect, useRef, useState } from "react";

type AnimationDirection = "up" | "down" | null;

interface AnimatedNumberState {
  displayValue: number | null;
  direction: AnimationDirection;
  isTicking: boolean;
}

export function useAnimatedNumber(value: number | null, duration = 500): AnimatedNumberState {
  const [displayValue, setDisplayValue] = useState<number | null>(value);
  const [direction, setDirection] = useState<AnimationDirection>(null);
  const [isTicking, setIsTicking] = useState(false);
  const previousValueRef = useRef<number | null>(value);
  const displayValueRef = useRef<number | null>(value);

  useEffect(() => {
    displayValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (value === null) {
      previousValueRef.current = null;
      displayValueRef.current = null;
      setDisplayValue(null);
      setDirection(null);
      setIsTicking(false);
      return;
    }

    const previousValue = previousValueRef.current;

    if (previousValue === null || !Number.isFinite(previousValue)) {
      previousValueRef.current = value;
      displayValueRef.current = value;
      setDisplayValue(value);
      setDirection(null);
      setIsTicking(false);
      return;
    }

    if (previousValue === value) {
      return;
    }

    const nextDirection: AnimationDirection = value > previousValue ? "up" : "down";
    const startValue = displayValueRef.current ?? previousValue;
    const startTime = performance.now();
    let frameId = 0;
    let timeoutId = 0;

    setDirection(nextDirection);
    setIsTicking(true);

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (value - startValue) * eased;

      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      previousValueRef.current = value;
      displayValueRef.current = value;
      setDisplayValue(value);
      timeoutId = window.setTimeout(() => {
        setIsTicking(false);
      }, 340);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [duration, value]);

  return {
    displayValue,
    direction,
    isTicking,
  };
}
