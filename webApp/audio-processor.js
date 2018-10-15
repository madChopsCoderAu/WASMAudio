/**
Copyright (c) 2017-2018 The WASM audio Authors. All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are
 met:

    * Redistributions of source code must retain the above copyright
 notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above
 copyright notice, this list of conditions and the following disclaimer
 in the documentation and/or other materials provided with the
 distribution.
    * Neither the name of mad chops coder AU nor the names of its
 contributors may be used to endorse or promote products derived from
 this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import {PolymerElement} from '@polymer/polymer/polymer-element.js';

/** A simple js based audio processor for running WASM audio processing
using the ScriptProcessorNode.
*/
export class AudioProcessor extends PolymerElement {

  /** Upon creation get the WASM loaded and compiling.
  */
  connectedCallback(){
    super.connectedCallback();
    let script = document.createElement('script');
    script.src = "libwasmaudio.js";
    document.head.appendChild(script);
  }

  /** Create and return an audio script node which is setup to process events.
  Upon completion :
  this.audioProcessorNode is the ScriptProcessorNode setup to handle events
  \param frameCount The number of audio frames in the processing buffer
  \param inCh The number of input audio channels
  \param outCh The number of output audio channels
  */
  createScriptProcessorNode(frameCount, inCh, outCh){
    this.audioProcessorNode = this.context.createScriptProcessor(frameCount, inCh, outCh);
    this.audioProcessorNode.onaudioprocess = this.process.bind(this);
    return this.audioProcessorNode;
  }

  /** malloc a WASM heap based on an audio matrix size. If the audio buffer
  channel count or frame count is changed, then free and malloc again.
  We remember size here to check if the heap frame count is different.
  \param audioMatrix Array[Array[Float32Array]]
  \param heapName For example 'inBufs'
  */
  mallocHEAP(byteLength, chCnt, heapName){
    let Nb=byteLength; // number of bytes
    let M=chCnt; // number of channels
    let N=M*Nb; // total byte count
    // resize memory if required
    if (this[heapName]==null || this[heapName+'Size']!=N){
      if (this[heapName]!=null)
      libwasmaudio.free(this[heapName]);
      this[heapName] = libwasmaudio._malloc(N);
      this[heapName+'Size']=N;
    }
    return Nb;
  }

  /** Given an audio process event, call the WASM process method and load the output.
  \param audioProcessingEvent The ScriptProcessorNode onaudioprocess event
  */
  process(audioProcessingEvent){
    let Nb = this.mallocHEAP(audioProcessingEvent.inputBuffer.length<<2, audioProcessingEvent.inputBuffer.numberOfChannels, 'inBufs'); // resize the heap if necessary
    for (var i=0; i<audioProcessingEvent.inputBuffer.numberOfChannels; i++) // load the AudioWorklet data into the WASM heap
      libwasmaudio.HEAPF32.subarray((this.inBufs)>>2, (this.inBufs+this.inBufsSize)>>2).set(audioProcessingEvent.inputBuffer.getChannelData(i), i*audioProcessingEvent.inputBuffer.length);

    Nb = this.mallocHEAP(audioProcessingEvent.outputBuffer.length<<2, audioProcessingEvent.outputBuffer.numberOfChannels, 'outBufs'); // resize the heap if necessary

    // process the audio
    let ret=this.audioProcessor.process(this.inBufs, audioProcessingEvent.inputBuffer.numberOfChannels, audioProcessingEvent.inputBuffer.length, this.outBufs, audioProcessingEvent.outputBuffer.numberOfChannels, audioProcessingEvent.outputBuffer.length);
    if (ret==true) // if processing was good, load the output audio
    for (var i=0; i<audioProcessingEvent.outputBuffer.numberOfChannels; i++) // retrieve the AudioWorklet data from the WASM heap
      audioProcessingEvent.outputBuffer.copyToChannel(libwasmaudio.HEAPF32.subarray((this.outBufs+i*Nb)>>2, (this.outBufs+i*Nb+Nb)>>2), i);
  }

  /** Method to stop processing.
  */
  stop(){
    if (this.audioProcessorNode != null)
      this.audioProcessorNode.disconnect();
  }
}
window.customElements.define('audio-processor', AudioProcessor);
