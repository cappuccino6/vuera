import React from 'react'
import Vue from 'vue'
import ReactWrapper from './React'
import { config } from '../../src'
import { gte } from '../utils/compare'

const VUE_COMPONENT_NAME = 'vuera-internal-component-name'

const wrapReactChildren = (createElement, children, _useFragment) => {
  /**
   * allow users to remove useless by _useFragment property while your React
   * version is greater then or equal to 16.2.0
   */
  const useFragment = React.Fragment !== undefined && gte(React.version, '16.2.0') && _useFragment

  createElement('vuera-internal-react-wrapper', {
    props: {
      component: () => {
        return useFragment ? <React.Fragment>{children}</React.Fragment> : <div>{children}</div>
      },
    },
  })
}

export default class VueContainer extends React.Component {
  constructor (props) {
    super(props)

    /**
     * We have to track the current Vue component so that we can reliably catch updates to the
     * `component` prop.
     */
    this.currentVueComponent = props.component

    /**
     * Modify createVueInstance function to pass this binding correctly. Doing this in the
     * constructor to avoid instantiating functions in render.
     */
    const createVueInstance = this.createVueInstance
    const self = this
    this.createVueInstance = function (element, component, prevComponent) {
      createVueInstance(element, self, component, prevComponent)
    }
  }

  componentWillReceiveProps (nextProps) {
    const { component, ...props } = nextProps

    if (this.currentVueComponent !== component) {
      this.updateVueComponent(this.props.component, component)
    }
    /**
     * NOTE: we're not comparing this.props and nextProps here, because I didn't want to write a
     * function for deep object comparison. I don't know if this hurts performance a lot, maybe
     * we do need to compare those objects.
     */
    Object.assign(this.vueInstance.$data, props)
  }

  componentWillUnmount () {
    this.vueInstance.$destroy()
  }

  /**
   * Creates and mounts the Vue instance.
   * NOTE: since we need to access the current instance of VueContainer, as well as the Vue instance
   * inside of the Vue constructor, we cannot bind this function to VueContainer, and we need to
   * pass VueContainer's binding explicitly.
   * @param {HTMLElement} targetElement - element to attact the Vue instance to
   * @param {ReactInstance} reactThisBinding - current instance of VueContainer
   */
  createVueInstance (targetElement, reactThisBinding) {
    const { component, on, ...props } = reactThisBinding.props

    // `this` refers to Vue instance in the constructor
    reactThisBinding.vueInstance = new Vue({
      el: targetElement,
      data: props,
      ...config.vueInstanceOptions,
      render (createElement) {
        return createElement(
          VUE_COMPONENT_NAME,
          {
            props: this.$data,
            on,
          },
          [wrapReactChildren(createElement, this.children, !!(props && props._useFragment))]
        )
      },
      components: {
        [VUE_COMPONENT_NAME]: component,
        'vuera-internal-react-wrapper': ReactWrapper,
      },
    })
  }

  updateVueComponent (prevComponent, nextComponent) {
    this.currentVueComponent = nextComponent

    /**
     * Replace the component in the Vue instance and update it.
     */
    this.vueInstance.$options.components[VUE_COMPONENT_NAME] = nextComponent
    this.vueInstance.$forceUpdate()
  }

  render () {
    return <div ref={this.createVueInstance} />
  }
}
