/**
 * media/ — VoiceRecorder (Web Speech, hold-to-talk, sample fallback), Waveform, AudioPlayer for transcript
 * "recordings" (TTS segment by segment or silent text timeline), TTS helpers and bundled clips. Barrel.
 */
export { VoiceRecorder, RECORDER, type VoiceRecorderProps, type VoiceResult } from './VoiceRecorder'
export { Waveform, WAVE, type WaveformProps, type WaveMarker } from './Waveform'
export { AudioPlayer, type AudioPlayerProps } from './AudioPlayer'
export { useSpeakText, SpeakButton, SpokenText } from './Speak'
export { usePlayback } from './usePlayback'
export {
  createPlayback,
  timeline,
  peaksForClip,
  segmentAt,
  wordsOf,
  mmss,
  PLAYBACK,
  type SpeechClip,
  type ClipSegment,
  type ClipMarker,
  type ClipSpeaker,
  type Playback,
  type PlaybackState,
  type PlaybackMode,
  type PlaybackOptions,
} from './playback'
export { speak, cancel, loadVoices, pickVoice, hasVoiceFor, ttsSupported, TTS, type SpeakOptions, type SpeakHandle, type SpeakResult } from './tts'
export { createRecognizer, recognitionSupported, speechLangs, SPEECH, type Recognizer, type RecognizerOptions, type RecognitionError } from './speech'
export { openMic, micSupported, micPermission, MicOpenError, MIC, type MicHandle, type MicError } from './mic'
export { MEETING_BANJIR, MEETING_BANJIR_NOTES, SALES_CALL, VOICE_NOTES, voiceNoteFromTemplate, type VoiceSample } from './samples'
