import { LitElement, html, css, customElement, property, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbPropertyValueChangeEvent} from "@umbraco-cms/backoffice/property-editor";
// Needed for language picker config values 'allowNull' and 'uniqueFilter'
import { type UmbPropertyEditorConfigCollection } from "@umbraco-cms/backoffice/property-editor";
import { UmbPropertyEditorUiElement } from "@umbraco-cms/backoffice/extension-registry";
import { UmbElementMixin } from "@umbraco-cms/backoffice/element-api";
// @ts-ignore
import { UmbWorkspaceContext, UMB_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT, UmbAuthContext } from "@umbraco-cms/backoffice/auth";
import { UMB_PROPERTY_CONTEXT } from '@umbraco-cms/backoffice/property';
import { UmbLanguageCollectionRepository } from "@umbraco-cms/backoffice/language";
import { UUISelectEvent } from "@umbraco-cms/backoffice/external/uui";
import type { UmbMenuStructureWorkspaceContext, UmbStructureItemModel } from '@umbraco-cms/backoffice/menu';

@customElement('umbraco-language-picker')
export default class UmbracoLanguagePickerElement extends UmbElementMixin(LitElement) implements UmbPropertyEditorUiElement
{
  @property()
  // @ts-ignore
  public value: string;

  @property()
  public displayValue: string | undefined;

  @property()
  public languageList: object[] = []

  @property()
  public contentNodeId: string | undefined;

  @property()
  public myAuthToken: Promise<string> | undefined;

  @property()
  public currentAlias = ""

  @property()
  public contentParentNode = ""

  @property()
  public languageError: boolean = false;

  @property()
  public mappedLanguageList: any = {}

  @property()
  private _lowerCaseNone: string = "";

  @property({attribute: false})
  public set config(config: UmbPropertyEditorConfigCollection) {
    this._allowNull = config.getValueByAlias("allowNull");
    this._uniqueFilter = config.getValueByAlias("uniqueFilter");
  }

  @state()
  isEditing: boolean = false;

  @state()
  private _allowNull?: boolean;

  @state()
  private _uniqueFilter?: boolean

  @state()
  // @ts-ignore
  private _selectedLanguage?: string;
  // @ts-ignore
  private languageCollectionRepository = new UmbLanguageCollectionRepository(this)

  // @ts-ignore
  private authorizationContext: UmbAuthContext;
  // @ts-ignore
  private myToken: Promise<string>;

  #workspaceContext?: any;
  #structureContext?: UmbMenuStructureWorkspaceContext;

  constructor() {
    super();
    this.consumeContext(UMB_WORKSPACE_CONTEXT, (context) => {
      this.#workspaceContext = context;
      //grab the node id (guid) from the context
      // @ts-ignore
      this.contentNodeId = context.getUnique();
    });
    this.consumeContext(UMB_AUTH_CONTEXT, (context) => {
      this.authorizationContext = context;
      this.myAuthToken = context.getLatestToken();
    })
    // To get the alias of the UmbracoLanguagePicker property editor you need to use this
    this.consumeContext(UMB_PROPERTY_CONTEXT, (propertyContext) => {
      this.observe(propertyContext.alias, async (propertyAlias) => {
        // @ts-ignore
        this.currentAlias = propertyAlias
      })
    })
    this.consumeContext('UmbMenuStructureWorkspaceContext', (instance: any) => {
      this.#structureContext = instance as UmbMenuStructureWorkspaceContext;
      this.#observeStructure();
    });
  }

  #observeStructure() {
    if (!this.#structureContext || !this.#workspaceContext) return;
    const isNew = this.#workspaceContext.getIsNew();

    this.observe(
        this.#structureContext.structure,
        (value) => {
          // TODO: get the type from the context
          const structure = value as Array<UmbStructureItemModel>;
          if(isNew)
          {
            if(this.isDocumentRoot())
            {
              // @ts-ignore
              this.contentParentNode = null;
            }
            else
            {
              // @ts-ignore
              this.contentParentNode = structure[structure.length - 1]?.unique;
            }
          }
          else
          {
            // @ts-ignore
            this.contentParentNode = structure[structure.length - 2]?.unique;
          }
        },
        'menuStructureObserver',
    );
  }

  isDocumentRoot() : boolean {
    return location.href.split("/").indexOf('document-root') > -1;
  }

  async firstUpdated(changed: any) {
    super.firstUpdated(changed)
    await this.getBackofficeLanguages()
    await this.getLanguages()
  }

  private async getBackofficeLanguages() {
    const {data} = await this.languageCollectionRepository.requestCollection({})
    this.mappedLanguageList[this._lowerCaseNone] = "NONE";
    data?.items.forEach(element => {
      this.mappedLanguageList[element.unique.toLowerCase()] = element.name
    })
    this.displayValue = this.mappedLanguageList[this.value || ""];
  }

  private async getLanguages() {
    try {
      const promiseToken = await this.myAuthToken;
      const headers = {
        Authorization: `Bearer ${promiseToken}`
      };
      const baseEndpoint = "/umbraco/management/api/v1/get-key-value-list"
      const data = await fetch(`${baseEndpoint}?parentNodeIdOrGuid=${this.contentParentNode}&nodeIdOrGuid=${this.contentNodeId}&propertyAlias=${this.currentAlias}&uniqueFilter=${!!this._uniqueFilter}&allowNull=${!!this._allowNull}`, {headers});
      const dataJson = await data.json()
      // Need to map it so the uui element can accept and display the data: https://uui.umbraco.com/?path=/docs/uui-select--docs
      const mappedData = dataJson.map((language:any) => {
        return { name: this.mappedLanguageList[language.key] || "NONE", value: language.key || this._lowerCaseNone, selected: language.key === this.value}
      })
      const mappedValue = mappedData.find((element: any) => element.value === this.value)
      this.languageList = mappedData;
      if(mappedValue) {
        this.displayValue = this.mappedLanguageList[mappedValue.value];
      }
      this.languageError = false;
    } catch (error) {
      this.languageError = true;
      console.error(error)
    }
  }

  private handleSelectChange(e: UUISelectEvent) {
    const langValue = e.target.value as string;
    this.value = langValue;
    this._selectedLanguage = langValue

    this.dispatchEvent(new UmbPropertyValueChangeEvent());
  }

  render() {
    return html`
      ${this.isEditing ?
        html`
            <uui-select .value=${this.value} label="select language" .options=${this.languageList} .placeholder=${this._allowNull ? "NONE" : html`<umb-localize key="umbracoLanguagePicker_selectAnOption">Select an option</umb-localize>`} @change=${this.handleSelectChange}>
            </uui-select>`
        :
        html`
            <span class="editing-text">
              ${this.value ? this.displayValue : html`<umb-localize key="umbracoLanguagePicker_selectLanguage">Select Language</umb-localize>`}
            </span>
          <uui-button look="secondary" color="default" class="data-api-picker-edit-label" role="button" @click=${() => this.isEditing = !this.isEditing}>
            <umb-localize key="umbracoLanguagePicker_edit">
              Edit
            </umb-localize>
          </uui-button>`}
      ${this.languageError ?  html`<p class="error-text">error when fetching languages</p>` : "" }
    `;
  }

  static styles = [
    css`
      .data-api-picker-edit-label {
        font-size: 13px;
      }
      .data-api-picker-edit-label:hover {
        color: #515054;
      }

      .editing-text {
        padding-right: 12px;
      }

      .error-text {
        color: var(--uui-color-danger);
      }
    `
  ];

}

declare global {
  interface HTMLElementTagNameMap {
    'umbraco-language-picker': UmbracoLanguagePickerElement;
  }
}