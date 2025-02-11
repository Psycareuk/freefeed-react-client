/* global CONFIG */
import { isValidElement, cloneElement, Component } from 'react';
import { Link } from 'react-router';
import { Mention, Email, HashTag, ForeignMention } from 'social-text-tokenizer';
import { faImage } from '@fortawesome/free-regular-svg-icons';
import { faFilm as faVideo } from '@fortawesome/free-solid-svg-icons';
import { faInstagram, faYoutube, faVimeo } from '@fortawesome/free-brands-svg-icons';
import classnames from 'classnames';

import { Arrows, Link as TLink, parseText, shortCodeToService } from '../utils/parse-text';
import { highlightString } from '../utils/search-highlighter';
import { FRIENDFEED_POST } from '../utils/link-types';
import { getMediaType } from './media-viewer';

import { Icon } from './fontawesome-icons';
import UserName from './user-name';
import ErrorBoundary from './error-boundary';

const MAX_URL_LENGTH = 50;
const { searchEngine } = CONFIG.search;

export default class Linkify extends Component {
  parseCounter = 0;

  processStrings(children, processor, excludeTags, mediaEl) {
    if (typeof children === 'string') {
      return processor(children, mediaEl);
    } else if (isValidElement(children) && !excludeTags.includes(children.type)) {
      return cloneElement(
        children,
        {},
        this.processStrings(children.props.children, processor, excludeTags, mediaEl),
      );
    } else if (Array.isArray(children)) {
      return children.map((ch) => this.processStrings(ch, processor, excludeTags, mediaEl));
    }
    return children;
  }

  parseString = (text, mediaEl) => {
    if (text === '') {
      return [];
    }

    return parseText(text).map((token, i) => {
      const key = i;

      const anchorEl = anchorElWithKey(key);
      const linkEl = linkElWithKey(key);

      if (token instanceof Mention) {
        return (
          <UserName
            user={{ username: token.text.slice(1).toLowerCase() }}
            userHover={this.props.userHover}
            key={key}
          >
            {token.text}
          </UserName>
        );
      }

      if (token instanceof Email) {
        return anchorEl(`mailto:${token.text}`, token.pretty);
      }

      if (token instanceof HashTag) {
        if (searchEngine) {
          return anchorEl(searchEngine + encodeURIComponent(token.text), token.text);
        }

        return linkEl({ pathname: '/search', query: { q: token.text } }, <bdi>{token.text}</bdi>);
      }

      if (token instanceof Arrows && this.props.arrowHover) {
        return (
          <span
            className="arrow-span"
            // eslint-disable-next-line react/jsx-no-bind
            onMouseEnter={() => this.props.arrowHover.hover(token.level)}
            onMouseLeave={this.props.arrowHover.leave}
            key={key}
          >
            {token.text}
          </span>
        );
      }

      if (token instanceof TLink) {
        if (token.isLocal) {
          let m, text;
          // Special shortening of post links
          if ((m = /^[^/]+\/[\w-]+\/[\da-f]{8}-/.exec(token.pretty))) {
            text = `${m[0]}\u2026`;
          } else {
            text = token.shorten(MAX_URL_LENGTH);
          }
          return linkEl(token.localURI, text);
        }

        if (token.href.match(FRIENDFEED_POST)) {
          return linkEl(
            { pathname: '/archivePost', query: { url: token.href } },
            token.shorten(MAX_URL_LENGTH),
          );
        }

        if (this.props.showMedia) {
          const mediaType = getMediaType(token.href);
          if (mediaType) {
            return mediaEl(token.href, token.shorten(MAX_URL_LENGTH), mediaType);
          }
        }

        return anchorEl(token.href, token.shorten(MAX_URL_LENGTH));
      }

      if (token instanceof ForeignMention) {
        const srv = shortCodeToService[token.service];
        if (srv) {
          const url = srv.linkTpl.replace(/{}/g, token.username);
          return anchorEl(url, token.text, `${srv.title} link`);
        }
      }

      return token.text;
    });
  };

  render() {
    this.parseCounter = 0;
    const hl = this.props.highlightTerms;
    const mediaEl = showMediaWithKey(this.props.showMedia);
    const parsed = this.processStrings(
      this.props.children,
      this.parseString,
      ['a', 'button', UserName],
      mediaEl,
    );
    if (!hl || hl.length === 0) {
      return (
        <span className="Linkify" dir="auto" role="region">
          <ErrorBoundary>{parsed}</ErrorBoundary>
        </span>
      );
    }
    const highlighted = this.processStrings(
      parsed,
      (str) => highlightString(str, hl),
      ['button'],
      mediaEl,
    );
    return (
      <span className="Linkify" dir="auto" role="region">
        <ErrorBoundary>{highlighted}</ErrorBoundary>
      </span>
    );
  }
}

function showMediaWithKey(showMedia) {
  const attachments = [];
  const handleOpenMedia = (index) => (e) => {
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }
    e.preventDefault();
    showMedia({ attachments, index });
  };

  return function (media, content, mediaType) {
    attachments.push({ url: media, id: 'comment', mediaType });
    const mediaIcon =
      {
        instagram: faInstagram,
        T_YOUTUBE_VIDEO: faYoutube,
        T_VIMEO_VIDEO: faVimeo,
        image: faImage,
      }[mediaType] || faVideo;

    return (
      <a
        href={media}
        target="_blank"
        dir="ltr"
        onClick={handleOpenMedia(attachments.length - 1)}
        key={`media${attachments.length}`}
        className={classnames('media-link', mediaType)}
        title="Click to view in Lightbox"
      >
        {mediaIcon && (
          <span className="icon-bond">
            <Icon icon={mediaIcon} className="media-icon" key={`icon${attachments.length}`} />
          </span>
        )}
        {content}
      </a>
    );
  };
}

function anchorElWithKey(key) {
  return function (href, content, title = null) {
    return (
      <a href={href} target="_blank" dir="ltr" key={key} title={title}>
        {content}
      </a>
    );
  };
}

function linkElWithKey(key) {
  return function (to, content, title = null) {
    return (
      <Link to={to} dir="ltr" key={key} title={title}>
        {content}
      </Link>
    );
  };
}
