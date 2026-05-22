import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AudioVisualSyncView } from '../components/AudioVisualSyncView';
import { AccessibilityEngineProvider } from '../context/AccessibilityEngineContext';
import * as Speech from 'expo-speech';

describe('AudioVisualSyncView', () => {
  it('renders words as touch nodes', () => {
    const { getByTestId } = render(
      <AccessibilityEngineProvider>
        <AudioVisualSyncView 
          text="Hello world this is a test" 
          isSpeaking={false} 
          onPlaybackComplete={jest.fn()} 
        />
      </AccessibilityEngineProvider>
    );

    expect(getByTestId('word-node-0')).toBeTruthy();
    expect(getByTestId('word-node-1')).toBeTruthy();
  });

  it('bi-directional tracking pointer triggers on touch node', () => {
    const onProgressMock = jest.fn();
    const { getByTestId } = render(
      <AccessibilityEngineProvider>
        <AudioVisualSyncView 
          text="Hello world this is a test" 
          isSpeaking={false} 
          onPlaybackComplete={jest.fn()} 
          onProgress={onProgressMock}
        />
      </AccessibilityEngineProvider>
    );

    const wordNode = getByTestId('word-node-2'); // "this"
    fireEvent.press(wordNode);

    expect(onProgressMock).toHaveBeenCalledWith(2);
    expect(Speech.speak).toHaveBeenCalledWith('this is a test', expect.any(Object));
  });
});
