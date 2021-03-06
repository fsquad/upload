/* eslint react/no-is-mounted:0 react/sort-comp:0 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import defaultRequest from './request';
import getUid from './uid';
import attrAccept from './attr-accept';

class AjaxUploader extends Component {
  static propTypes = {
    component: PropTypes.string,
    style: PropTypes.object,
    prefixCls: PropTypes.string,
    className: PropTypes.string,
    multiple: PropTypes.bool,
    disabled: PropTypes.bool,
    accept: PropTypes.string,
    children: PropTypes.any,
    onStart: PropTypes.func,
    data: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.func,
    ]),
    headers: PropTypes.object,
    beforeUpload: PropTypes.func,
    customRequest: PropTypes.func,
    onProgress: PropTypes.func,
    withCredentials: PropTypes.bool,
  }

  state = { uid: getUid() }

  reqs = {}

  onChange = e => {
    const files = e.target.files;
    this.uploadFiles(files);
    this.reset();
  }

  onClick = () => {
    const el = this.fileInput;
    if (!el) {
      return;
    }
    el.click();
  }

  onKeyDown = e => {
    if (e.key === 'Enter') {
      this.onClick();
    }
  }

  onFileDrop = e => {
    if (e.type === 'dragover') {
      e.preventDefault();
      return;
    }
    const handleFile = (file) => this.uploadFiles([file]);
    const handleEntries = (entries) => {
      entries.forEach((file) => {
        if (file.isFile) {
          file.file(handleFile);
        } else if (file.isDirectory) {
          const dirReader = file.createReader();
          dirReader.readEntries(handleEntries);
        }
      }
    };

    // Check for Chrome webkitdirectory
    const tmpInput = document.createElement('input');
    if ('webkitdirectory' in tmpInput
        || 'mozdirectory' in tmpInput
        || 'odirectory' in tmpInput
        || 'msdirectory' in tmpInput
        || 'directory' in tmpInput) {
      const items = e.nativeEvent.dataTransfer.items;
      const length = items.length;
      for (let i = 0; i < length; i++) {
        const entry = e.dataTransfer.items[i].webkitGetAsEntry();
        if (entry.isFile) {
          entry.file(handleFile);
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          dirReader.readEntries(handleEntries);
        }
      }
    } else {
      const files = e.dataTransfer.files;
      this.uploadFiles(files);
    }

    e.preventDefault();
  }

  componentDidMount() {
    this._isMounted = true;
    this.refs.file.webkitdirectory = true;
    this.refs.file.mozdirectory = true;
    this.refs.file.odirectory = true;
    this.refs.file.msdirectory = true;
    this.refs.file.directory = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
    this.abort();
  }

  uploadFiles(files) {
    const postFiles = Array.prototype.slice.call(files);
    postFiles.forEach((file) => {
      file.uid = getUid();
      this.upload(file, postFiles);
    });
  }

  upload(file, fileList) {
    const { props } = this;
    if (!props.beforeUpload) {
      // always async in case use react state to keep fileList
      return setTimeout(() => this.post(file), 0);
    }

    const before = props.beforeUpload(file, fileList);
    if (before && before.then) {
      before.then((processedFile) => {
        const processedFileType = Object.prototype.toString.call(processedFile);
        if (processedFileType === '[object File]' || processedFileType === '[object Blob]') {
          this.post(processedFile);
        } else {
          this.post(file);
        }
      }).catch(e => {
        console && console.log(e); // eslint-disable-line
      });
    } else if (before !== false) {
      setTimeout(() => this.post(file), 0);
    }
  }

  post(file) {
    if (!this._isMounted) {
      return;
    }
    const { props } = this;
    let { data } = props;
    const { onStart, onProgress } = props;
    if (typeof data === 'function') {
      data = data(file);
    }
    const { uid } = file;
    const request = props.customRequest || defaultRequest;
    this.reqs[uid] = request({
      action: props.action,
      filename: props.name,
      file,
      data,
      headers: props.headers,
      withCredentials: props.withCredentials,
      onProgress: onProgress ? e => {
        onProgress(e, file);
      } : null,
      onSuccess: (ret, xhr) => {
        delete this.reqs[uid];
        props.onSuccess(ret, file, xhr);
      },
      onError: (err, ret) => {
        delete this.reqs[uid];
        props.onError(err, ret, file);
      },
    });
    onStart(file);
  }

  reset() {
    this.setState({
      uid: getUid(),
    });
  }

  abort(file) {
    const { reqs } = this;
    if (file) {
      let uid = file;
      if (file && file.uid) {
        uid = file.uid;
      }
      if (reqs[uid]) {
        reqs[uid].abort();
        delete reqs[uid];
      }
    } else {
      Object.keys(reqs).forEach((uid) => {
        if (reqs[uid]) {
          reqs[uid].abort();
        }

        delete reqs[uid];
      });
    }
  }

  saveFileInput = (node) => {
    this.fileInput = node;
  }

  render() {
    const {
      component: Tag, prefixCls, className, disabled,
      style, multiple, accept, children,
    } = this.props;
    const cls = classNames({
      [prefixCls]: true,
      [`${prefixCls}-disabled`]: disabled,
      [className]: className,
    });
    const events = disabled ? {} : {
      onClick: this.onClick,
      onKeyDown: this.onKeyDown,
      onDrop: this.onFileDrop,
      onDragOver: this.onFileDrop,
      tabIndex: '0',
    };
    return (
      <Tag
        {...events}
        className={cls}
        role="button"
        style={style}
      >
        <input
          type="file"
          ref={this.saveFileInput}
          key={this.state.uid}
          style={{ display: 'none' }}
          accept={accept}
          multiple={multiple}
          onChange={this.onChange}
        />
        {children}
      </Tag>
    );
  }
}

export default AjaxUploader;
